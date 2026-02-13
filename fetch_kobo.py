#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
fetch_kobo.py
- Fetch KoboToolbox submissions (JSON) from an asset
- Produce:
  1) data.json   -> aggregated dashboard indicators (Top1/Top2/Top3 + others) + by_org_type
  2) records.json-> "clean" records for the main table (NO system fields), incl. narratives

Env vars required:
  KOBO_TOKEN      : Kobo API Token
  KOBO_ASSET_ID   : Asset UID (xform) in Kobo
Optional:
  KOBO_API_URL    : default https://kf.kobotoolbox.org
"""

import os
import json
from collections import Counter
from typing import Dict, Any, List

import requests
import pandas as pd


# ---------------------------
# Configuration
# ---------------------------

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL", "https://kf.kobotoolbox.org").rstrip("/")

if not KOBO_TOKEN or not ASSET_ID:
    raise SystemExit("Missing env vars: KOBO_TOKEN, KOBO_ASSET_ID (and optionally KOBO_API_URL).")

API_URL = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"
HEADERS = {"Authorization": f"Token {KOBO_TOKEN}"}

# IMPORTANT: Adapt labels to your XLSForm codes.
# Keep them short and professional (no jargon).
LABELS: Dict[str, Dict[str, str]] = {
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
        "ssr": "Services SSR",
        "clinique_72h": "Prise en charge clinique <72h",
        "mhpss": "Soutien psychosocial",
        "juridique": "Assistance juridique",
        "abri": "Hébergement sécurisé",
    },
    "gravite": {
        "faible": "Faible",
        "moderee": "Modérée",
        "elevee": "Élevée",
        "critique": "Critique",
    },
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
        "meilleur_ciblage": "Meilleur ciblage",
        "autre": "Autre",
    },
    "digital_lim": {
        "connectivite": "Coupures réseau / électricité",
        "confidentialite": "Confidentialité",
        "exclusion": "Exclusion numérique",
        "cout": "Coûts de maintenance",
        "autre": "Autre",
    },
    # OPTIONAL (if you want to labelize obstacles_wlo codes; if they match risk codes you can reuse "risque".
    "obstacles_wlo": {
        "administratif": "Contraintes administratives",
        "fiduciaire": "Contraintes fiduciaires",
        "securite": "Problèmes de sécurité",
        "acces_info": "Accès limité à l’information",
        "capacite": "Capacités organisationnelles limitées",
        "autre": "Autre",
    },
}


# ---------------------------
# Helpers
# ---------------------------

def labelize(domain: str, code: Any) -> str:
    if code is None:
        return ""
    return LABELS.get(domain, {}).get(str(code), str(code))


def safe_series(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col] if col in df.columns else pd.Series(dtype="object")


def count_multiselect(series: pd.Series) -> Dict[str, int]:
    """
    Kobo multiselect comes as a space-separated string: "a b c".
    """
    c = Counter()
    for v in series.dropna().astype(str):
        v = v.strip()
        if not v:
            continue
        c.update(v.split())
    return dict(c)


def to_label_counts(domain: str, counts: Dict[str, int]) -> Dict[str, int]:
    labeled = {labelize(domain, k): int(v) for k, v in (counts or {}).items()}
    return dict(sorted(labeled.items(), key=lambda kv: kv[1], reverse=True))


def multiselect_labels(domain: str, s: Any) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    if not s:
        return ""
    codes = s.split()
    labs = [labelize(domain, c) for c in codes]
    labs = [x for x in labs if x]
    return ", ".join(labs)


def fetch_all_results(url: str, headers: Dict[str, str], timeout: int = 60) -> List[Dict[str, Any]]:
    """
    Handles pagination for Kobo API v2 results.
    """
    out: List[Dict[str, Any]] = []
    next_url = url
    while next_url:
        r = requests.get(next_url, headers=headers, timeout=timeout)
        r.raise_for_status()
        payload = r.json()
        out.extend(payload.get("results", []))
        next_url = payload.get("next")
    return out


def build_aggregates(df: pd.DataFrame) -> Dict[str, Any]:
    return {
        "total_responses": int(len(df)),

        # Services (Top 1 / 2 / 3)
        "top_service_1": to_label_counts("service", safe_series(df, "bloc_a/service_top1").value_counts().to_dict()),
        "top_service_2": to_label_counts("service", safe_series(df, "bloc_a/service_top2").value_counts().to_dict()),
        "top_service_3": to_label_counts("service", safe_series(df, "bloc_a/service_top3").value_counts().to_dict()),

        # Other indicators
        "gravite": to_label_counts("gravite", safe_series(df, "bloc_a/rupture_gravite").value_counts().to_dict()),
        "provinces_prioritaires": to_label_counts("province", count_multiselect(safe_series(df, "bloc_d/provinces_prioritaires"))),
        "groupes_sous_servis": to_label_counts("groupes", count_multiselect(safe_series(df, "bloc_d/groupes_sous_servis"))),
        "risques_operationnels": to_label_counts("risque", count_multiselect(safe_series(df, "bloc_e/risques_operationnels"))),
        "digital_avantages": to_label_counts("digital_adv", count_multiselect(safe_series(df, "bloc_f/avantages_digital"))),
        "digital_limites": to_label_counts("digital_lim", count_multiselect(safe_series(df, "bloc_f/limites_digital"))),
    }


def col(df: pd.DataFrame, name: str, default: str = "") -> pd.Series:
    return df[name] if name in df.columns else pd.Series([default] * len(df))


# ---------------------------
# Main
# ---------------------------

def main() -> None:
    # Fetch
    results = fetch_all_results(API_URL, HEADERS)
    df = pd.json_normalize(results)

    generated_at = pd.Timestamp.utcnow().isoformat()

    # 1) data.json (dashboard)
    summary = build_aggregates(df)

    by_org_type: Dict[str, Any] = {}
    if "org_type" in df.columns:
        for org_code, sub in df.groupby("org_type", dropna=False):
            org_label = labelize("org_type", org_code)
            by_org_type[org_label] = build_aggregates(sub)

    data_payload = {
        "generated_at": generated_at,   # (dashboard may ignore it)
        "labels": LABELS,
        "summary": summary,
        "by_org_type": by_org_type,
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data_payload, f, ensure_ascii=False, indent=2)

    # 2) records.json (for the main table)
    # IMPORTANT: we intentionally DO NOT include system fields (_id, _uuid, submitted_by, status, etc.)
    rec = pd.DataFrame()

    # We create a display date field (no system metadata shown on UI)
    # If you prefer NO date at all, you can remove this entirely.
    # Here we keep 'date' only as YYYY-MM-DD (safe).
    if "_submission_time" in df.columns:
        rec["date"] = pd.to_datetime(df["_submission_time"], errors="coerce").dt.date.astype(str)
    else:
        rec["date"] = ""

    rec["org_name"] = col(df, "org_name", "")
    rec["org_type_label"] = col(df, "org_type", "").map(lambda x: labelize("org_type", x))

    rec["province_base_label"] = col(df, "province_base", "").map(lambda x: labelize("province", x))
    rec["territoire_base_label"] = col(df, "territoire_base", "").astype(str)

    rec["service_top1_label"] = col(df, "bloc_a/service_top1", "").map(lambda x: labelize("service", x))
    rec["service_top2_label"] = col(df, "bloc_a/service_top2", "").map(lambda x: labelize("service", x))
    rec["service_top3_label"] = col(df, "bloc_a/service_top3", "").map(lambda x: labelize("service", x))

    rec["rupture_gravite_label"] = col(df, "bloc_a/rupture_gravite", "").map(lambda x: labelize("gravite", x))

    # Narratives (multiline text)
    rec["approches_efficaces"] = col(df, "bloc_a/approches_efficaces", "")
    rec["valeur_ajoutee"] = col(df, "bloc_b/valeur_ajoutee", "")
    rec["effet_systemique"] = col(df, "bloc_b/effet_systemique", "")

    # WLO obstacles (multiselect) + solutions (narrative)
    obstacles_raw = col(df, "bloc_c/obstacles_wlo", "")
    rec["obstacles_wlo"] = obstacles_raw
    rec["obstacles_wlo_label"] = obstacles_raw.map(lambda s: multiselect_labels("obstacles_wlo", s))
    rec["solutions_wlo"] = col(df, "bloc_c/solutions_wlo", "")

    # Targeting
    prov_prio_raw = col(df, "bloc_d/provinces_prioritaires", "")
    rec["provinces_prioritaires"] = prov_prio_raw
    rec["provinces_prioritaires_label"] = prov_prio_raw.map(lambda s: multiselect_labels("province", s))

    groupes_raw = col(df, "bloc_d/groupes_sous_servis", "")
    rec["groupes_sous_servis"] = groupes_raw
    rec["groupes_sous_servis_label"] = groupes_raw.map(lambda s: multiselect_labels("groupes", s))

    rec["mecanisme_feedback"] = col(df, "bloc_d/mecanisme_feedback", "")

    # Risks
    risques_raw = col(df, "bloc_e/risques_operationnels", "")
    rec["risques_operationnels"] = risques_raw
    rec["risques_operationnels_label"] = risques_raw.map(lambda s: multiselect_labels("risque", s))
    rec["mesures_mitigation"] = col(df, "bloc_e/mesures_mitigation", "")

    # Digital
    adv_raw = col(df, "bloc_f/avantages_digital", "")
    rec["avantages_digital"] = adv_raw
    rec["avantages_digital_label"] = adv_raw.map(lambda s: multiselect_labels("digital_adv", s))

    lim_raw = col(df, "bloc_f/limites_digital", "")
    rec["limites_digital"] = lim_raw
    rec["limites_digital_label"] = lim_raw.map(lambda s: multiselect_labels("digital_lim", s))

    rec["apport_digital"] = col(df, "bloc_f/apport_digital", "")

    # Clean NaNs
    rec = rec.fillna("")

    records_payload = {
        "generated_at": generated_at,  # UI can ignore; no need to display
        "records": rec.to_dict(orient="records")
    }

    with open("records.json", "w", encoding="utf-8") as f:
        json.dump(records_payload, f, ensure_ascii=False, indent=2)

    print("✅ Generated: data.json + records.json")
    print(f"   submissions: {len(df)}")


if __name__ == "__main__":
    main()
