import os
import sys
import json
import requests
from urllib.parse import urljoin

def build_data_url(kobo_api_url: str, asset_id: str) -> str:
    """
    Accepte:
      - base URL: https://kf.kobotoolbox.org
      - ou endpoint complet: https://kf.kobotoolbox.org/api/v2/assets/<id>/data/
    Retourne toujours l'endpoint data canonique.
    """
    if not kobo_api_url:
        raise ValueError("KOBO_API_URL est vide.")
    if not asset_id:
        raise ValueError("KOBO_ASSET_ID est vide.")

    u = kobo_api_url.strip()

    # Lien UI → interdit
    if "#/forms/" in u:
        raise ValueError(
            "KOBO_API_URL pointe vers l'interface web (#/forms/...). "
            "Utilise l'API: https://kf.kobotoolbox.org/api/v2/assets/<ASSET_ID>/data/"
        )

    # Si l'utilisateur a déjà mis l'endpoint data complet
    if "/api/v2/assets/" in u and "/data" in u:
        # Normaliser pour finir par /data/
        if not u.endswith("/"):
            u += "/"
        return u

    # Si l'utilisateur a mis /api/v2/assets/<id> sans /data/
    if "/api/v2/assets/" in u and "/data" not in u:
        if not u.endswith("/"):
            u += "/"
        return u + "data/"

    # Sinon: base URL (recommandé)
    base = u
    if not base.endswith("/"):
        base += "/"
    return urljoin(base, f"api/v2/assets/{asset_id}/data/")

def ensure_json_response(r: requests.Response):
    ctype = (r.headers.get("content-type") or "").lower()
    if r.status_code >= 400:
        preview = (r.text or "")[:400].replace("\n", " ")
        raise RuntimeError(f"HTTP {r.status_code} — Réponse: {preview}")
    if "json" not in ctype:
        preview = (r.text or "")[:400].replace("\n", " ")
        raise RuntimeError(
            f"Réponse non-JSON (content-type={ctype}). "
            f"Probable erreur d'auth/accès. Preview: {preview}"
        )

def fetch_all(data_url: str, token: str) -> dict:
    headers = {"Authorization": f"Token {token}"}
    params = {"format": "json"}  # KoBo renvoie parfois JSON sans mais on force.

    out = {"count": 0, "next": None, "previous": None, "results": []}

    url = data_url
    page = 1
    while url:
        print(f"➡️ Fetch page {page}: {url}")
        r = requests.get(url, headers=headers, params=params, timeout=60)
        ensure_json_response(r)

        payload = r.json()
        if page == 1:
            out["count"] = payload.get("count", 0)
            out["previous"] = payload.get("previous")

        out["results"].extend(payload.get("results", []))
        url = payload.get("next")  # Kobo pagination canonique
        out["next"] = url
        page += 1

    out["count"] = len(out["results"])  # sécurise la cohérence
    return out

def main():
    kobo_api_url = os.getenv("KOBO_API_URL", "").strip()
    asset_id = os.getenv("KOBO_ASSET_ID", "").strip()
    token = os.getenv("KOBO_TOKEN", "").strip()

    if not token:
        print("❌ KOBO_TOKEN manquant (GitHub Secret KOBO_TOKEN).")
        sys.exit(2)

    data_url = build_data_url(kobo_api_url, asset_id)

    payload = fetch_all(data_url, token)

    os.makedirs("data", exist_ok=True)
    with open("data/raw_kobo.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ OK — {payload.get('count', 0)} soumissions enregistrées dans data/raw_kobo.json")

if __name__ == "__main__":
    main()
