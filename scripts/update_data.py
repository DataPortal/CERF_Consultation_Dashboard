import os
import json
import requests
from datetime import datetime, timezone


# ---------------------------------------------------
# Helpers
# ---------------------------------------------------

def must_env(name: str) -> str:
    """Get required environment variable."""
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


def safe_get(d: dict, key: str, default=None):
    """Safe dictionary get."""
    return d.get(key, default)


# ---------------------------------------------------
# Main
# ---------------------------------------------------

def main():

    # --- Environment variables (GitHub Actions) ---
    base_url = must_env("KOBO_BASE_URL").rstrip("/")
    asset_uid = must_env("KOBO_ASSET_ID")
    token = must_env("KOBO_TOKEN")

    # --- Kobo API endpoint ---
    url = f"{base_url}/api/v2/assets/{asset_uid}/data.json"

    headers = {
        "Authorization": f"Token {token}"
    }

    print(f"Fetching data from {url} ...")

    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()

    payload = r.json()

    submissions = payload.get("results", [])
    print(f"Submissions found: {len(submissions)}")

    rows = []

    # ---------------------------------------------------
    # Flatten repeat group
    # ---------------------------------------------------
    for sub in submissions:

        base = {
            "date": safe_get(sub, "grp_main/date_jour"),
            "agent_id": safe_get(sub, "grp_main/agent_id"),
            "agent": safe_get(sub, "grp_main/agent"),
            "bureau": safe_get(sub, "grp_main/bureau"),
            "submission_time": safe_get(sub, "_submission_time"),
            "_id": safe_get(sub, "_id"),
            "_uuid": safe_get(sub, "_uuid"),
            "_status": safe_get(sub, "_status"),
        }

        repeats = sub.get("grp_main/rep_taches", []) or []

        # If no repeat found
        if not repeats:
            rows.append({
                **base,
                "tache": None,
                "lien_activite": None,
                "code_activite": None,
                "resultat": None,
                "commentaire": None,
                "task_timestamp": None,
            })
            continue

        # Flatten each task
        for t in repeats:
            row = {
                **base,
                "tache": safe_get(t, "grp_main/rep_taches/tache"),
                "lien_activite": safe_get(t, "grp_main/rep_taches/lien_activite"),
                "code_activite": safe_get(t, "grp_main/rep_taches/code_activite"),
                "resultat": safe_get(t, "grp_main/rep_taches/resultat"),
                "commentaire": safe_get(t, "grp_main/rep_taches/commentaire"),
                "task_timestamp": safe_get(t, "grp_main/rep_taches/timestamp"),
            }
            rows.append(row)

    # ---------------------------------------------------
    # Sort data (latest first)
    # ---------------------------------------------------
    rows.sort(
        key=lambda x: (
            x.get("date") or "",
            x.get("bureau") or "",
            x.get("agent") or ""
        ),
        reverse=True
    )

    # ---------------------------------------------------
    # Write dashboard data file
    # ---------------------------------------------------
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"data.json generated ({len(rows)} rows)")

    # ---------------------------------------------------
    # Small metadata log
    # ---------------------------------------------------
    now = datetime.now(timezone.utc).isoformat()
    print(f"Refresh completed at {now}")


if __name__ == "__main__":
    main()
