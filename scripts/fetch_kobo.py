import os
import json
import time
from typing import Any, Dict, List, Optional

import requests


def die(msg: str) -> None:
    raise SystemExit(f"❌ {msg}")


def get_env(name: str) -> str:
    v = os.getenv(name, "").strip()
    if not v:
        die(f"Variable d'environnement manquante: {name}")
    return v


def fetch_all(url: str, token: str, page_size: int = 1000, max_pages: int = 500) -> Dict[str, Any]:
    """
    Kobo v2 data endpoint returns:
      { "count": int, "next": url|null, "previous": url|null, "results": [...] }
    """
    headers = {
        "Authorization": f"Token {token}",
        "Accept": "application/json",
    }

    params = {"limit": page_size}
    all_results: List[Dict[str, Any]] = []

    next_url: Optional[str] = url
    page = 0

    while next_url:
        page += 1
        if page > max_pages:
            die(f"Trop de pages (> {max_pages}). Vérifie l'URL ou augmente max_pages.")

        print(f"➡️  Fetch page {page}: {next_url}")
        r = requests.get(next_url, headers=headers, params=params, timeout=60)

        if r.status_code == 401:
            die("Unauthorized (401). Token KOBO invalide ou expiré.")
        if r.status_code == 403:
            die("Forbidden (403). Token OK mais pas d'accès à l'asset.")
        if not r.ok:
            die(f"Erreur HTTP {r.status_code}: {r.text[:300]}")

        payload = r.json()
        results = payload.get("results", [])
        if not isinstance(results, list):
            die("Format inattendu: 'results' n'est pas une liste.")

        all_results.extend(results)
        next_url = payload.get("next")

        # Respect rate limits
        time.sleep(0.2)

        # Kobo ignore params sur next_url (next_url est déjà complet)
        params = {}

    out = {
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(all_results),
        "results": all_results,
    }
    return out


def main() -> None:
    url = get_env("KOBO_API_URL")
    token = get_env("KOBO_API_TOKEN")

    # Normalise l'URL (assure /data/)
    if not url.endswith("/"):
        url += "/"
    if "/data/" not in url:
        # on n'essaie pas de deviner l'asset id ici, mais on alerte
        print("⚠️ KOBO_API_URL ne contient pas '/data/'. Assure-toi que c'est bien l'endpoint data de l'asset.")

    payload = fetch_all(url, token)

    os.makedirs("data", exist_ok=True)
    out_path = os.path.join("data", "raw.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ raw sauvegardé: {out_path} ({payload['count']} soumissions)")


if __name__ == "__main__":
    main()
