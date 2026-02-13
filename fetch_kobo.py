#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
fetch_kobo.py (aligned with revised Kobo JSON)
Generates:
  - data.json    : aggregates for dashboard + by_org_type (optional)
  - records.json : clean records for table (no system fields), incl narratives

Required env vars:
  KOBO_TOKEN
  KOBO_ASSET_ID
Optional:
  KOBO_API_URL (default https://kf.kobotoolbox.org)
"""

import os
import json
from collections import Counter
from typing import Dict, Any, List

import requests
import pandas as pd


# =========================
# CONFIG
# =========================

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL", "https://kf.kobotoolbox.org").rstrip("/")

if not KOBO_TOKEN or not ASSET_ID:
    raise SystemExit("Missing env vars: KOBO_TOKEN and KOBO_ASSET_ID (optional KOBO_API_URL).")

API_URL = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"
HEADERS = {"Authorization": f"Token {KOBO_TOKEN}"}


# =========================
# LABELS (codes -> human)
# =========================
# Ajuste au besoin si tu ajoutes des choix dans Kobo.
LABELS: Dict[str, Dict[str, str]] = {
    # intro
    "org_type": {
        "ingo": "ONG internationale",
        "ngo": "ONG nationale",
        "wlo": "Organisation conduite par des femmes (WLO)",
        "un": "Agence des Nations Unies",
        "gov": "Gouvernement / Autorité",
        "autre": "Autre",
    },
    "cluster": {
        "protection": "Protection",
        "coordination": "Coordination",
        "gbv": "VBG",
        "giha": "GIHA",
        "health": "Santé",
        "wash": "WASH",
        "shelter": "Abris",
        "food": "Sécurité alimentaire",
        "nutrition": "Nutrition",
        "education": "Éducation",
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
    "consent": {"yes": "Oui", "no": "Non"},

    # Bloc A
    "service": {
        "medical_72h": "Prise en charge médicale <72h",
        "mhpss": "Soutien psychosocial (MHPSS)",
        "juridique": "Assistance juridique",
        "abri": "Hébergement sécurisé",
        "ssr": "Services SSR",
        "autre": "Autre",
    },
    "gravity": {
        "faible": "Faible",
        "moderee": "Modérée",
        "grave": "Grave",
        "critique": "Critique",
    },
    "restore_time": {
        "moins_7j": "Moins de 7 jours",
        "entre_7_30j": "7 à 30 jours",
        "plus_30j": "Plus de 30 jours",
    },
    "approaches": {
        "cash": "Cash / assistance",
        "agr": "AGR / moyens d’existence",
        "safe_space": "Espaces sûrs",
        "case_mgmt": "Gestion de cas",
        "referral": "Renforcement du référencement",
        "autre": "Autre",
    },

    # Bloc B
    "additionality": {
        "scale": "Extension de la couverture",
        "system": "Renforcement système / coordination",
        "data": "Données / suivi / redevabilité",
        "quality": "Amélioration qualité des services",
        "autre": "Autre",
    },
    "innovation_level": {
        "faible": "Faible",
        "moyenne": "Moyenne",
        "elevee": "Élevée",
    },

    # Bloc C
    "obstacles": {
        "administratif": "Contraintes administratives",
        "fiduciaire": "Contraintes fiduciaires",
        "securite": "Problèmes de sécurité",
        "acces": "Accès / présence limitée",
        "acces_info": "Accès limité à l’information",
        "capacite": "Capacités organisationnelles limitées",
        "autre": "Autre",
    },
    "governance": {
        "quota": "Quotas de participation / leadership",
        "fin_direct": "Financement direct / subventions",
        "co_lead": "Co-leadership / gouvernance conjointe",
        "redevabilite": "Mécanismes de redevabilité",
        "autre": "Autre",
    },
    "capacity": {
        "gestion_projet": "Gestion de projet",
        "gbv": "VBG (standards/qualité)",
        "coordination": "Coordination",
        "giha": "GIHA / mainstreaming",
        "data": "Suivi & données",
        "autre": "Autre",
    },

    # Bloc D
    "underserved": {
        "ado_10_14": "Adolescentes 10–14 ans",
        "ado_15_19": "Adolescentes 15–19 ans",
        "handicap": "Femmes/filles en situation de handicap",
        "cheffes": "Femmes cheffes de ménage",
        "deplacees": "Femmes déplacées",
        "survivantes": "Survivantes de VBG",
        "autre": "Autre",
    },
    "meca": {
        "points_focaux": "Points focaux / relais communautaires",
        "boites": "Boîtes à suggestions",
        "hotline": "Hotline",
        "digitaux": "Canaux digitaux",
        "autre": "Autre",
    },
    "feedback_channel": {
        "whatsapp_sms": "WhatsApp / SMS",
        "hotline": "Hotline",
        "in_person": "En présentiel (points focaux)",
        "boites": "Boîtes à suggestions",
        "autre": "Autre",
    },

    # Bloc E
    "risks": {
        "securite": "Insécurité",
        "acces": "Accès humanitaire limité",
        "donnees": "Confidentialité / données",
        "rh": "Ressources humaines limitées",
        "supply": "Chaîne d’approvisionnement",
        "autre": "Autre",
    },
    "funds": {
        "cbpf_hrf": "CBPF/HRF",
        "wphf": "WPHF",
        "untf": "UNTF EVAW/G",
        "bilateral": "Bailleurs bilatéraux",
        "autre": "Autre",
    },
    "critical_need": {
        "restore": "Rétablissement / continuité des services",
        "access": "Accès & référencement",
        "protection": "Protection immédiate",
        "coordination": "Coordination",
        "data": "Données / suivi",
    },

    # Bloc F
    "digital_adv": {
        "rapidite": "Suivi plus rapide",
        "tracabilite": "Traçabilité",
        "temps_reel": "Temps réel",
        "desag": "Désagrégation améliorée",
        "autre": "Autre",
    },
    "digital_lim": {
        "connectivite": "Coupures réseau / électricité",
        "confidentialite": "Risques de confidentialité",
        "litteratie": "Faible littératie numérique",
        "couts": "Coûts de maintenance",
        "exclusion": "Exclusion numérique",
        "autre": "Autre",
    },
    "un_support": {
        "brokerage": "Facilitation / intermédiation (brokerage)",
        "capacity": "Renforcement des capacités",
        "compliance": "Protection des données / conformité",
        "coordination": "Appui coordination",
        "autre": "Autre",
    },
}


# =========================
# Helpers
# =========================

def labelize(domain: str, code: Any) -> str:
    if code is None:
        return ""
    return LABELS.get(domain, {}).get(str(code), str(code))

def safe_series(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col] if col in df.columns else pd.Series(dtype="object")

def count_multiselect(series: pd.Series) -> Dict[str, int]:
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

def fetch_all(url: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    next_url = url
    while next_url:
        r = requests.get(next_url, headers=HEADERS, timeout=60)
        r.raise_for_status()
        payload = r.json()
        out.extend(payload.get("results", []))
        next_url = payload.get("next")
    return out

def col(df: pd.DataFrame, name: str, default: str = "") -> pd.Series:
    return df[name] if name in df.columns else pd.Series([default] * len(df))

def build_aggregates(df: pd.DataFrame) -> Dict[str, Any]:
    # Intro
    clusters = to_label_counts("cluster", count_multiselect(safe_series(df, "intro/cluster")))
    org_types = to_label_counts("org_type", safe_series(df, "intro/org_type").value_counts().to_dict())
    provinces_base = to_label_counts("province", safe_series(df, "intro/province").value_counts().to_dict())
    other_prov = to_label_counts("province", count_multiselect(safe_series(df, "intro/other_provinces")))

    # Bloc A
    top1 = to_label_counts("service", safe_series(df, "bloc_a/a1_service_top1").value_counts().to_dict())
    top2 = to_label_counts("service", safe_series(df, "bloc_a/a1_service_top2").value_counts().to_dict())
    top3 = to_label_counts("service", safe_series(df, "bloc_a/a1_service_top3").value_counts().to_dict())
    gravity = to_label_counts("gravity", safe_series(df, "bloc_a/a2_referral_gravity").value_counts().to_dict())
    restore_time = to_label_counts("restore_time", safe_series(df, "bloc_a/a3_restore_time").value_counts().to_dict())
    approaches = to_label_counts("approaches", count_multiselect(safe_series(df, "bloc_a/a4_approaches")))

    # Bloc B
    additionality = to_label_counts("additionality", count_multiselect(safe_series(df, "bloc_b/b1_additionality")))
    innovation_level = to_label_counts("innovation_level", safe_series(df, "bloc_b/b2_innovation").value_counts().to_dict())

    # Bloc C
    obstacles = to_label_counts("obstacles", count_multiselect(safe_series(df, "bloc_c/c1_obstacles")))
    governance = to_label_counts("governance", count_multiselect(safe_series(df, "bloc_c/c2_governance")))
    capacity = to_label_counts("capacity", count_multiselect(safe_series(df, "bloc_c/c3_capacity")))

    # Bloc D
    priority_areas = to_label_counts("province", count_multiselect(safe_series(df, "bloc_d/d1_priority_areas")))
    underserved = to_label_counts("underserved", count_multiselect(safe_series(df, "bloc_d/d2_underserved")))
    meca = to_label_counts("meca", count_multiselect(safe_series(df, "bloc_d/d4_meca")))
    feedback_channel = to_label_counts("feedback_channel", safe_series(df, "bloc_d/d5_feedback").value_counts().to_dict())

    # Bloc E
    risks = to_label_counts("risks", count_multiselect(safe_series(df, "bloc_e/e1_risks")))
    funds = to_label_counts("funds", count_multiselect(safe_series(df, "bloc_e/e2_funds")))
    critical_need = to_label_counts("critical_need", safe_series(df, "bloc_e/besoin_plus_critique").value_counts().to_dict())

    # Bloc F
    digital_adv = to_label_counts("digital_adv", count_multiselect(safe_series(df, "bloc_f/f1_advantages")))
    digital_lim = to_label_counts("digital_lim", count_multiselect(safe_series(df, "bloc_f/f1_limits")))
    un_support = to_label_counts("un_support", count_multiselect(safe_series(df, "bloc_f/f2_un_support")))

    return {
        "total_responses": int(len(df)),

        # Intro aggregates
        "org_types": org_types,
        "clusters": clusters,
        "province_base": provinces_base,
        "other_provinces": other_prov,

        # Bloc A
        "top_service_1": top1,
        "top_service_2": top2,
        "top_service_3": top3,
        "referral_gravity": gravity,
        "restore_time": restore_time,
        "approaches": approaches,

        # Bloc B
        "additionality": additionality,
        "innovation_level": innovation_level,

        # Bloc C
        "obstacles_wlo": obstacles,
        "governance_mechanisms": governance,
        "capacity_needs": capacity,

        # Bloc D
        "priority_areas": priority_areas,
        "underserved_groups": underserved,
        "accountability_mechanisms": meca,
        "feedback_channel": feedback_channel,

        # Bloc E
        "operational_risks": risks,
        "funds_leverage": funds,
        "critical_need": critical_need,

        # Bloc F
        "digital_advantages": digital_adv,
        "digital_limits": digital_lim,
        "un_support": un_support,
    }


def main() -> None:
    results = fetch_all(API_URL)
    df = pd.json_normalize(results)
    generated_at = pd.Timestamp.utcnow().isoformat()

    summary = build_aggregates(df)

    # by_org_type scope
    by_org_type: Dict[str, Any] = {}
    if "intro/org_type" in df.columns:
        for code, sub in df.groupby("intro/org_type", dropna=False):
            by_org_type[labelize("org_type", code)] = build_aggregates(sub)

    data_payload = {
        "generated_at": generated_at,
        "labels": LABELS,
        "summary": summary,
        "by_org_type": by_org_type,
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data_payload, f, ensure_ascii=False, indent=2)

    # records.json for the main table (clean, no system fields)
    rec = pd.DataFrame()

    rec["date_interview"] = col(df, "intro/date_interview", "")
    rec["organisation"] = col(df, "intro/organisation", "")
    rec["org_type_label"] = col(df, "intro/org_type", "").map(lambda x: labelize("org_type", x))
    rec["cluster_label"] = col(df, "intro/cluster", "").map(lambda s: multiselect_labels("cluster", s))
    rec["province_label"] = col(df, "intro/province", "").map(lambda x: labelize("province", x))
    rec["admin2"] = col(df, "intro/admin2", "").astype(str)  # label admin2 optional (si tu fournis un mapping)
    rec["other_provinces_label"] = col(df, "intro/other_provinces", "").map(lambda s: multiselect_labels("province", s))
    rec["consent_label"] = col(df, "intro/consent", "").map(lambda x: labelize("consent", x))

    # Bloc A
    rec["service_top1_label"] = col(df, "bloc_a/a1_service_top1", "").map(lambda x: labelize("service", x))
    rec["service_top2_label"] = col(df, "bloc_a/a1_service_top2", "").map(lambda x: labelize("service", x))
    rec["service_top3_label"] = col(df, "bloc_a/a1_service_top3", "").map(lambda x: labelize("service", x))
    rec["a1_where"] = col(df, "bloc_a/a1_where", "")
    rec["referral_gravity_label"] = col(df, "bloc_a/a2_referral_gravity", "").map(lambda x: labelize("gravity", x))
    rec["a2_where"] = col(df, "bloc_a/a2_referral_where", "")
    rec["restore_time_label"] = col(df, "bloc_a/a3_restore_time", "").map(lambda x: labelize("restore_time", x))
    rec["approaches_label"] = col(df, "bloc_a/a4_approaches", "").map(lambda s: multiselect_labels("approaches", s))

    # Bloc B
    rec["additionality_label"] = col(df, "bloc_b/b1_additionality", "").map(lambda s: multiselect_labels("additionality", s))
    rec["b1_explain"] = col(df, "bloc_b/b1_explain", "")
    rec["innovation_level_label"] = col(df, "bloc_b/b2_innovation", "").map(lambda x: labelize("innovation_level", x))
    rec["b2_explain"] = col(df, "bloc_b/b2_explain", "")
    rec["toc"] = col(df, "bloc_b/b3_toc", "")

    # Bloc C
    rec["obstacles_label"] = col(df, "bloc_c/c1_obstacles", "").map(lambda s: multiselect_labels("obstacles", s))
    rec["c1_solutions"] = col(df, "bloc_c/c1_solutions", "")
    rec["governance_label"] = col(df, "bloc_c/c2_governance", "").map(lambda s: multiselect_labels("governance", s))
    rec["capacity_label"] = col(df, "bloc_c/c3_capacity", "").map(lambda s: multiselect_labels("capacity", s))
    rec["c4_coordination"] = col(df, "bloc_c/c4_coordination", "")

    # Bloc D
    rec["priority_areas_label"] = col(df, "bloc_d/d1_priority_areas", "").map(lambda s: multiselect_labels("province", s))
    rec["underserved_label"] = col(df, "bloc_d/d2_underserved", "").map(lambda s: multiselect_labels("underserved", s))
    rec["saddd"] = col(df, "bloc_d/d3_saddd", "")
    rec["meca_label"] = col(df, "bloc_d/d4_meca", "").map(lambda s: multiselect_labels("meca", s))
    rec["trust_plus"] = col(df, "bloc_d/d4_trust_plus", "")
    rec["trust_minus"] = col(df, "bloc_d/d4_trust_minus", "")
    rec["feedback_channel_label"] = col(df, "bloc_d/d5_feedback", "").map(lambda x: labelize("feedback_channel", x))

    # Bloc E
    rec["risks_label"] = col(df, "bloc_e/e1_risks", "").map(lambda s: multiselect_labels("risks", s))
    rec["e1_mitigation"] = col(df, "bloc_e/e1_mitigation", "")
    rec["funds_label"] = col(df, "bloc_e/e2_funds", "").map(lambda s: multiselect_labels("funds", s))
    rec["e3_results"] = col(df, "bloc_e/e3_results", "")
    rec["critical_need_label"] = col(df, "bloc_e/besoin_plus_critique", "").map(lambda x: labelize("critical_need", x))

    # Bloc F
    rec["digital_adv_label"] = col(df, "bloc_f/f1_advantages", "").map(lambda s: multiselect_labels("digital_adv", s))
    rec["digital_lim_label"] = col(df, "bloc_f/f1_limits", "").map(lambda s: multiselect_labels("digital_lim", s))
    rec["f1_strengthen"] = col(df, "bloc_f/f1_strengthen", "")
    rec["un_support_label"] = col(df, "bloc_f/f2_un_support", "").map(lambda s: multiselect_labels("un_support", s))
    rec["f2_details"] = col(df, "bloc_f/f2_details", "")

    rec = rec.fillna("")

    with open("records.json", "w", encoding="utf-8") as f:
        json.dump({"generated_at": generated_at, "records": rec.to_dict(orient="records")}, f, ensure_ascii=False, indent=2)

    print("✅ Generated: data.json + records.json")
    print(f"   submissions: {len(df)}")


if __name__ == "__main__":
    main()
