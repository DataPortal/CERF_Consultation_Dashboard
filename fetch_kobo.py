import os
import json
from collections import Counter
import requests
import pandas as pd

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL", "https://kf.kobotoolbox.org").rstrip("/")

if not KOBO_TOKEN or not ASSET_ID:
    raise SystemExit("Missing env vars: KOBO_TOKEN, KOBO_ASSET_ID (and optionally KOBO_API_URL).")

URL = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"
HEADERS = {"Authorization": f"Token {KOBO_TOKEN}"}

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
        "bas_uele": "Bas-Uele","equateur": "Équateur","haut_katanga": "Haut-Katanga","haut_lomami": "Haut-Lomami",
        "haut_uele": "Haut-Uele","ituri": "Ituri","kasai": "Kasaï","kasai_central": "Kasaï-Central",
        "kasai_oriental": "Kasaï-Oriental","kinshasa": "Kinshasa","kongo_central": "Kongo Central","kwango": "Kwango",
        "kwilu": "Kwilu","lomami": "Lomami","lualaba": "Lualaba","mai_ndombe": "Mai-Ndombe","maniema": "Maniema",
        "mongala": "Mongala","nord_kivu": "Nord-Kivu","nord_ubangi": "Nord-Ubangi","sankuru": "Sankuru",
        "sud_kivu": "Sud-Kivu","sud_ubangi": "Sud-Ubangi","tanganyika": "Tanganyika","tshopo": "Tshopo","tshuapa": "Tshuapa",
    },
    "service": {
        "clinique_72h": "Prise en charge clinique <72h",
        "mhpss": "Soutien psychosocial",
        "juridique": "Assistance juridique",
        "abri": "Hébergement sécurisé",
        "ssr": "Services de santé sexuelle et reproductive",
    },
    "gravite": {"faible": "Faible","moderee": "Modérée","elevee": "Élevée","critique": "Critique"},
    "consent": {"yes": "Oui", "no": "Non"},
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

def labelize(domain: str, code):
    if code is None:
        return ""
    return LABELS.get(domain, {}).get(str(code), str(code))

def safe_series(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col] if col in df.columns else pd.Series(dtype="object")

def count_multiselect(series: pd.Series) -> dict:
    c = Counter()
    for v in series.dropna().astype(str):
        v = v.strip()
        if not v: 
            continue
        c.update(v.split())
    return dict(c)

def to_label_counts(domain: str, counts: dict) -> dict:
    labeled = {labelize(domain, k): int(v) for k, v in counts.items()}
    return dict(sorted(labeled.items(), key=lambda kv: kv[1], reverse=True))

def multiselect_labels(domain: str, s: str) -> str:
    if not s:
        return ""
    codes = str(s).split()
    labs = [labelize(domain, c) for c in codes]
    return ", ".join([x for x in labs if x])

def build_aggregates(df: pd.DataFrame) -> dict:
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

    generated_at = pd.Timestamp.utcnow().isoformat()

    # data.json (dashboard)
    summary = build_aggregates(df)
    by_org_type = {}
    if "org_type" in df.columns:
        for org_code, sub in df.groupby("org_type"):
            by_org_type[labelize("org_type", org_code)] = build_aggregates(sub)

    out = {
        "generated_at": generated_at,
        "labels": LABELS,
        "summary": summary,
        "by_org_type": by_org_type,
    }
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # records.json (table) – include narratives
    # Keep a clean set of fields (add more if needed)
    rec = pd.DataFrame()
    def col(src, default=""):
        return df[src] if src in df.columns else default

    rec["submission_time"] = col("_submission_time", "")
    rec["org_name"] = col("org_name", "")
    rec["org_type"] = col("org_type", "")
    rec["org_type_label"] = rec["org_type"].map(lambda x: labelize("org_type", x))
    rec["province_base"] = col("province_base", "")
    rec["province_base_label"] = rec["province_base"].map(lambda x: labelize("province", x))
    rec["territoire_base"] = col("territoire_base", "")
    rec["territoire_base_label"] = rec["territoire_base"]  # (territoire labels optional)
    rec["consent"] = col("consent", "")
    rec["consent_label"] = rec["consent"].map(lambda x: labelize("consent", x))

    rec["service_top1"] = col("bloc_a/service_top1", "")
    rec["service_top1_label"] = rec["service_top1"].map(lambda x: labelize("service", x))
    rec["service_top2"] = col("bloc_a/service_top2", "")
    rec["service_top2_label"] = rec["service_top2"].map(lambda x: labelize("service", x))
    rec["service_top3"] = col("bloc_a/service_top3", "")
    rec["service_top3_label"] = rec["service_top3"].map(lambda x: labelize("service", x))

    rec["rupture_gravite"] = col("bloc_a/rupture_gravite", "")
    rec["rupture_gravite_label"] = rec["rupture_gravite"].map(lambda x: labelize("gravite", x))

    # Narratives
    rec["approches_efficaces"] = col("bloc_a/approches_efficaces", "")
    rec["valeur_ajoutee"] = col("bloc_b/valeur_ajoutee", "")
    rec["effet_systemique"] = col("bloc_b/effet_systemique", "")
    rec["solutions_wlo"] = col("bloc_c/solutions_wlo", "")
    rec["mecanisme_feedback"] = col("bloc_d/mecanisme_feedback", "")
    rec["mesures_mitigation"] = col("bloc_e/mesures_mitigation", "")
    rec["apport_digital"] = col("bloc_f/apport_digital", "")

    # Multi-select fields: keep both raw and labeled string
    rec["obstacles_wlo"] = col("bloc_c/obstacles_wlo", "")
    rec["obstacles_wlo_label"] = rec["obstacles_wlo"].map(lambda s: multiselect_labels("risque", s) if s else "")  # optional mapping; keep raw too

    rec["provinces_prioritaires"] = col("bloc_d/provinces_prioritaires", "")
    rec["provinces_prioritaires_label"] = rec["provinces_prioritaires"].map(lambda s: multiselect_labels("province", s))

    rec["groupes_sous_servis"] = col("bloc_d/groupes_sous_servis", "")
    rec["groupes_sous_servis_label"] = rec["groupes_sous_servis"].map(lambda s: multiselect_labels("groupes", s))

    rec["risques_operationnels"] = col("bloc_e/risques_operationnels", "")
    rec["risques_operationnels_label"] = rec["risques_operationnels"].map(lambda s: multiselect_labels("risque", s))

    rec["avantages_digital"] = col("bloc_f/avantages_digital", "")
    rec["avantages_digital_label"] = rec["avantages_digital"].map(lambda s: multiselect_labels("digital_adv", s))

    rec["limites_digital"] = col("bloc_f/limites_digital", "")
    rec["limites_digital_label"] = rec["limites_digital"].map(lambda s: multiselect_labels("digital_lim", s))

    records_out = {
        "generated_at": generated_at,
        "records": rec.fillna("").to_dict(orient="records")
    }
    with open("records.json", "w", encoding="utf-8") as f:
        json.dump(records_out, f, ensure_ascii=False, indent=2)

    print("✅ Generated: data.json + records.json")

if __name__ == "__main__":
    main()
