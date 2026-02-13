import os
import json
from collections import Counter, defaultdict
import requests
import pandas as pd

"""
CERF Consultation Dashboard – Kobo → GitHub Pages
- Fetch submissions from Kobo (Asset Data endpoint)
- Build:
    1) data.json (aggregates for default view)
    2) records.json (minimal anonymized records for client-side filtering)
    3) labels.json (code → label mapping for clean display)
"""

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL", "https://kf.kobotoolbox.org").rstrip("/")

if not KOBO_TOKEN or not ASSET_ID:
    raise SystemExit("Missing env vars: KOBO_TOKEN, KOBO_ASSET_ID (and optionally KOBO_API_URL).")

URL = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"
HEADERS = {"Authorization": f"Token {KOBO_TOKEN}"}


# ----------------------- Code → Label dictionaries -----------------------
LABELS = {
    "org_type": {
        "wlo": "Organisation conduite par des femmes",
        "ong_nat": "ONG nationale",
        "ong_int": "ONG internationale",
        "agence_onu": "Agence des Nations Unies",
        "gouvernement": "Gouvernement / Autorité",
        "autre": "Autre",
    },
    "province": {
        "bas_uele": "Bas-Uele",
        "equateur": "Équateur",
        "haut_katanga": "Haut-Katanga",
        "haut_lomami": "Haut-Lomami",
        "haut_uele": "Haut-Uele",
        "ituri": "Ituri",
        "kasai": "Kasaï",
        "kasai_central": "Kasaï-Central",
        "kasai_oriental": "Kasaï-Oriental",
        "kinshasa": "Kinshasa",
        "kongo_central": "Kongo Central",
        "kwango": "Kwango",
        "kwilu": "Kwilu",
        "lomami": "Lomami",
        "lualaba": "Lualaba",
        "mai_ndombe": "Mai-Ndombe",
        "maniema": "Maniema",
        "mongala": "Mongala",
        "nord_kivu": "Nord-Kivu",
        "nord_ubangi": "Nord-Ubangi",
        "sankuru": "Sankuru",
        "sud_kivu": "Sud-Kivu",
        "sud_ubangi": "Sud-Ubangi",
        "tanganyika": "Tanganyika",
        "tshopo": "Tshopo",
        "tshuapa": "Tshuapa",
    },
    "service": {
        "clinique_72h": "Prise en charge clinique <72h",
        "mhpss": "Soutien psychosocial",
        "juridique": "Assistance juridique",
        "abri": "Hébergement sécurisé",
        "ssr": "Services de santé sexuelle et reproductive",
    },
    "gravite": {
        "faible": "Faible",
        "moderee": "Modérée",
        "elevee": "Élevée",
        "critique": "Critique",
    },
    "risque": {
        "insecurite": "Insécurité",
        "acces_limite": "Accès humanitaire limité",
        "ressources_humaines": "Manque de ressources humaines",
        "approvisionnement": "Rupture chaîne d’approvisionnement",
        "donnees": "Risques liés aux données / confidentialité",
        "autre": "Autre",
    },
    "digital_adv": {
        "rapidite": "Suivi plus rapide",
        "transparence": "Transparence accrue",
        "donnees_desag": "Données désagrégées plus rapidement",
        "meilleur_ciblage": "Meilleur ciblage des bénéficiaires",
        "autre": "Autre",
    },
    "digital_lim": {
        "connectivite": "Coupures réseau / électricité",
        "confidentialite": "Risques de confidentialité",
        "exclusion": "Exclusion numérique des plus vulnérables",
        "cout": "Coûts de maintenance",
        "autre": "Autre",
    },
    "groupes": {
        "adolescentes_10_14": "Adolescentes 10–14 ans",
        "adolescentes_15_19": "Adolescentes 15–19 ans",
        "deplacees": "Femmes déplacées",
        "cheffes_menage": "Femmes cheffes de ménage",
        "handicap": "Femmes en situation de handicap",
        "survivantes_vbg": "Survivantes de VBG",
        "autre": "Autre",
    },
}


def labelize(domain: str, code: str) -> str:
    if code is None:
        return ""
    return LABELS.get(domain, {}).get(code, code)


def count_multiselect(series: pd.Series) -> dict:
    """Multiselect are space-separated codes."""
    counter = Counter()
    for v in series.dropna().astype(str):
        v = v.strip()
        if not v:
            continue
        counter.update(v.split())
    return dict(counter)


def to_label_counts(domain: str, counts: dict) -> dict:
    """Convert {code: n} → {label: n} (stable order for charts on client)."""
    labeled = {labelize(domain, k): int(v) for k, v in counts.items()}
    # sort by value desc
    return dict(sorted(labeled.items(), key=lambda kv: kv[1], reverse=True))


def safe_get(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col] if col in df.columns else pd.Series(dtype="object")


def main():
    r = requests.get(URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    results = r.json().get("results", [])
    df = pd.json_normalize(results)

    # --- Minimal anonymized records for filtering on the client ---
    keep_cols = {
        "org_type": "org_type",
        "province_base": "province_base",
        "territoire_base": "territoire_base",
        "bloc_a/service_top1": "service_top1",
        "bloc_a/service_top2": "service_top2",
        "bloc_a/service_top3": "service_top3",
        "bloc_a/rupture_gravite": "rupture_gravite",
        "bloc_d/provinces_prioritaires": "provinces_prioritaires",
        "bloc_d/groupes_sous_servis": "groupes_sous_servis",
        "bloc_e/risques_operationnels": "risques_operationnels",
        "bloc_f/avantages_digital": "avantages_digital",
        "bloc_f/limites_digital": "limites_digital",
        "_submission_time": "submission_time",
        "_status": "status",
    }
    rec = pd.DataFrame()
    for src, dst in keep_cols.items():
        if src in df.columns:
            rec[dst] = df[src]
        else:
            rec[dst] = None

    # Convert codes to labels in records for cleaner UI
    rec["org_type_label"] = rec["org_type"].map(lambda x: labelize("org_type", x))
    rec["province_base_label"] = rec["province_base"].map(lambda x: labelize("province", x))
    rec["service_top1_label"] = rec["service_top1"].map(lambda x: labelize("service", x))
    rec["rupture_gravite_label"] = rec["rupture_gravite"].map(lambda x: labelize("gravite", x))

    records = rec.to_dict(orient="records")

    # --- Aggregates for default view (no filter) ---
    summary = {}
    summary["total_responses"] = int(len(rec))

    summary["top_service"] = to_label_counts(
        "service", safe_get(df, "bloc_a/service_top1").value_counts().to_dict()
    )
    summary["gravite"] = to_label_counts(
        "gravite", safe_get(df, "bloc_a/rupture_gravite").value_counts().to_dict()
    )
    summary["provinces_prioritaires"] = to_label_counts(
        "province", count_multiselect(safe_get(df, "bloc_d/provinces_prioritaires"))
    )
    summary["groupes_sous_servis"] = to_label_counts(
        "groupes", count_multiselect(safe_get(df, "bloc_d/groupes_sous_servis"))
    )
    summary["risques_operationnels"] = to_label_counts(
        "risque", count_multiselect(safe_get(df, "bloc_e/risques_operationnels"))
    )
    summary["digital_avantages"] = to_label_counts(
        "digital_adv", count_multiselect(safe_get(df, "bloc_f/avantages_digital"))
    )
    summary["digital_limites"] = to_label_counts(
        "digital_lim", count_multiselect(safe_get(df, "bloc_f/limites_digital"))
    )

    # --- Aggregates by org_type for faster client filtering ---
    by_org = {}
    for org_code, group in rec.groupby("org_type"):
        # Find subset mask in original df by index
        idx = group.index
        sub_df = df.loc[idx] if len(df) else pd.DataFrame()
        by_org[labelize("org_type", org_code)] = {
            "total_responses": int(len(group)),
            "top_service": to_label_counts("service", safe_get(sub_df, "bloc_a/service_top1").value_counts().to_dict()),
            "gravite": to_label_counts("gravite", safe_get(sub_df, "bloc_a/rupture_gravite").value_counts().to_dict()),
            "provinces_prioritaires": to_label_counts("province", count_multiselect(safe_get(sub_df, "bloc_d/provinces_prioritaires"))),
            "groupes_sous_servis": to_label_counts("groupes", count_multiselect(safe_get(sub_df, "bloc_d/groupes_sous_servis"))),
            "risques_operationnels": to_label_counts("risque", count_multiselect(safe_get(sub_df, "bloc_e/risques_operationnels"))),
            "digital_avantages": to_label_counts("digital_adv", count_multiselect(safe_get(sub_df, "bloc_f/avantages_digital"))),
            "digital_limites": to_label_counts("digital_lim", count_multiselect(safe_get(sub_df, "bloc_f/limites_digital"))),
        }

    out = {
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "labels": LABELS,
        "summary": summary,
        "by_org_type": by_org,
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    with open("records.json", "w", encoding="utf-8") as f:
        json.dump({"records": records}, f, ensure_ascii=False, indent=2)

    with open("labels.json", "w", encoding="utf-8") as f:
        json.dump(LABELS, f, ensure_ascii=False, indent=2)

    print("✅ Generated: data.json, records.json, labels.json")


if __name__ == "__main__":
    main()
