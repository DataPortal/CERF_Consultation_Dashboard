import os
import json
from collections import Counter
import requests
import pandas as pd

# ------------------ ENV ------------------
KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL", "https://kf.kobotoolbox.org").rstrip("/")

if not KOBO_TOKEN or not ASSET_ID:
    raise SystemExit("Missing env vars: KOBO_TOKEN, KOBO_ASSET_ID (and optionally KOBO_API_URL).")

URL = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"
HEADERS = {"Authorization": f"Token {KOBO_TOKEN}"}

# ------------------ LABELS ------------------
LABELS = {
    "org_type": {
        "wlo": "Organisation conduite par des femmes",
        "ong_nat": "ONG nationale",
        "ong_int": "ONG internationale",
        "agence_onu": "Agence des Nations Unies",
        "gouvernement": "Gouvernement / Autorité",
        "autre": "Autre",
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
    "groupes": {
        "adolescentes_10_14": "Adolescentes 10–14 ans",
        "adolescentes_15_19": "Adolescentes 15–19 ans",
        "deplacees": "Femmes déplacées",
        "cheffes_menage": "Femmes cheffes de ménage",
        "handicap": "Femmes en situation de handicap",
        "survivantes_vbg": "Survivantes de VBG",
        "autre": "Autre",
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
}

def labelize(domain: str, code: str) -> str:
    if code is None:
        return ""
    return LABELS.get(domain, {}).get(code, str(code))

def safe_series(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col] if col in df.columns else pd.Series(dtype="object")

def count_multiselect(series: pd.Series) -> dict:
    """
    Kobo multiselect: 'a b c' (space-separated codes)
    Return: {code: count}
    """
    counter = Counter()
    for v in series.dropna().astype(str):
        v = v.strip()
        if not v:
            continue
        counter.update(v.split())
    return dict(counter)

def to_label_counts(domain: str, counts: dict) -> dict:
    """
    Convert {code: n} → {label: n}, sorted desc.
    """
    labeled = {labelize(domain, k): int(v) for k, v in counts.items()}
    return dict(sorted(labeled.items(), key=lambda kv: kv[1], reverse=True))

def build_aggregates(df: pd.DataFrame) -> dict:
    """
    Build all aggregates for a given df slice (global or per org_type)
    Output is label-ready for dashboard.
    """
    return {
        "total_responses": int(len(df)),
        "top_service": to_label_counts("service", safe_series(df, "bloc_a/service_top1").value_counts().to_dict()),
        "gravite": to_label_counts("gravite", safe_series(df, "bloc_a/rupture_gravite").value_counts().to_dict()),
        "provinces_prioritaires": to_label_counts("province", count_multiselect(safe_series(df, "bloc_d/provinces_prioritaires"))),
        "groupes_sous_servis": to_label_counts("groupes", count_multiselect(safe_series(df, "bloc_d/groupes_sous_servis"))),
        "risques_operationnels": to_label_counts("risque", count_multiselect(safe_series(df, "bloc_e/risques_operationnels"))),
        "digital_avantages": to_label_counts("digital_adv", count_multiselect(safe_series(df, "bloc_f/avantages_digital"))),
        "digital_limites": to_label_counts("digital_lim", count_multiselect(safe_series(df, "bloc_f/limites_digital"))),
    }

def main():
    r = requests.get(URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    results = r.json().get("results", [])
    df = pd.json_normalize(results)

    # ---- Global aggregates ----
    summary = build_aggregates(df)

    # ---- Aggregates by org_type ----
    by_org_type = {}
    if "org_type" in df.columns:
        for org_code, sub in df.groupby("org_type"):
            label = labelize("org_type", org_code)
            by_org_type[label] = build_aggregates(sub)

    out = {
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "labels": LABELS,
        "summary": summary,
        "by_org_type": by_org_type,
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("✅ Generated data.json with summary + by_org_type")

if __name__ == "__main__":
    main()
