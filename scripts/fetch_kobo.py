#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import time
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import requests


def die(msg: str, code: int = 2):
    print(msg)
    sys.exit(code)


def ensure_data_endpoint(url: str) -> str:
    u = url.strip()
    if not u:
        return u

    # Kobo v2 endpoint should look like .../api/v2/assets/<uid>/data/
    if "/api/v2/assets/" not in u:
        return u  # we will validate later

    if "/data" not in u:
        # append /data/
        if u.endswith("/"):
            u = u + "data/"
        else:
            u = u + "/data/"
    else:
        # ensure trailing slash for consistency
        if not u.endswith("/"):
            u = u + "/"
    return u


def add_query(url: str, **params) -> str:
    """Safely add/merge query params."""
    p = urlparse(url)
    q = parse_qs(p.query)
    for k, v in params.items():
        q[k] = [str(v)]
    new_query = urlencode(q, doseq=True)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, new_query, p.fragment))


def is_html_response(r: requests.Response) -> bool:
    ct = (r.headers.get("Content-Type") or "").lower()
    if "text/html" in ct:
        return True
    # Also detect Kobo login HTML
    sample = (r.text or "")[:200].lower()
    if "<html" in sample or "<!doctype html" in sample:
        return True
    return False


def fetch_all(api_url: str, token: str, page_size: int = 300) -> dict:
    """
    Fetch all submissions from Kobo asset data endpoint.
    Returns dict: {count, results, next, previous} normalized where results holds all rows.
    """
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Token {token}",
        "Accept": "application/json",
        "User-Agent": "CERF_Consultation_Dashboard/1.0"
    })

    url = add_query(api_url, format="json", page_size=page_size)

    all_rows = []
    seen_pages = 0
    t0 = time.time()

    while url:
        seen_pages += 1
        print(f"➡️  Fetch page {seen_pages}: {url}")

        r = session.get(url, timeout=60)

        if r.status_code == 401 or r.status_code == 403:
            # Most common: missing/invalid token (returns HTML or JSON)
            die("❌ Auth KOBO échouée (401/403). Vérifie GitHub Secret KOBO_TOKEN.", 2)

        if not r.ok:
            die(f"❌ Erreur HTTP {r.status_code}: {r.text[:500]}", 1)

        if is_html_response(r):
            die("❌ Réponse HTML reçue (pas JSON). KOBO_API_URL est mauvais ou KOBO_TOKEN manquant/incorrect.", 1)

        try:
            payload = r.json()
        except Exception:
            die("❌ Impossible de parser JSON. Vérifie KOBO_API_URL (/api/v2/assets/<uid>/data/) et KOBO_TOKEN.", 1)

        rows = payload.get("results") or []
        all_rows.extend(rows)

        url = payload.get("next")  # Kobo provides absolute next URL
        # small pause to be gentle
        time.sleep(0.15)

    dt = time.time() - t0
    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(all_rows),
        "results": all_rows
    }
    print(f"✅ Total fetched: {len(all_rows)} rows in {dt:.1f}s")
    return out


def main():
    token = os.getenv("KOBO_TOKEN", "").strip()
    api_url = os.getenv("KOBO_API_URL", "").strip()

    if not token:
        die("❌ KOBO_TOKEN manquant (GitHub Secret KOBO_TOKEN).", 2)
    if not api_url:
        die("❌ KOBO_API_URL manquant (GitHub Secret KOBO_API_URL).", 2)

    api_url = ensure_data_endpoint(api_url)

    if "/api/v2/assets/" not in api_url or "/data/" not in api_url:
        die("⚠️ KOBO_API_URL invalide. Il doit être: https://kf.kobotoolbox.org/api/v2/assets/<ASSET_UID>/data/", 2)

    data = fetch_all(api_url, token)

    with open("kobo_raw.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("✅ Wrote kobo_raw.json")


if __name__ == "__main__":
    main()
