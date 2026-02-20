import os
import json
from typing import Any, Dict, List, Tuple, Optional

import pandas as pd


def die(msg: str) -> None:
    raise SystemExit(f"❌ {msg}")


def load_json(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        die(f"Fichier introuvable: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def safe_str(x: Any) -> str:
    if x is None:
        return ""
    s = str(x).strip()
    return s


def split_multi(x: Any) -> List[str]:
    """
    Kobo multi-select sort souvent comme: "choice_a choice_b choice_c"
    ou parfois déjà en liste.
    """
    if x is None:
        return []
    if isinstance(x, list):
        return [safe_str(v) for v in x if safe_str(v)]
    s = safe_str(x)
    if not s:
        return []
    return [p.strip() for p in s.split() if p.strip()]


def count_series(values: List[str]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for v in values:
        if not v:
            continue
        out[v] = out.get(v, 0) + 1
    return out


def df_from_results(results: List[Dict[str, Any]]) -> pd.DataFrame:
    # Aplatit JSON
    df = pd.json_normalize(results)

    # Harmonisation: certains champs sont "intro/organisation" etc.
    # On renomme vers tes clés attendues par tes scripts front.
    rename_map = {
        "intro/organisation": "organisation",
        "intro/org_type": "org_type",
        "intro/cluster": "cluster",
        "intro/province": "province",
        "intro/admin2": "admin2",
        "intro/other_provinces": "other_provinces",
        "intro/date_interview": "date_interview",
        "intro/consent": "consent",

        # Exemple de blocs (adapte si tes noms exacts diffèrent)
        "bloc_a/a1_service_top1": "service_top1",
        "bloc_a/a1_service_top2": "service_top2",
        "bloc_a/a1_service_top3": "service_top3",
        "bloc_a/a1_where": "a1_where",
        "bloc_a/a2_where": "a2_where",
        "bloc_a/referral_gravity": "referral_gravity",
        "bloc_a/restore_time": "restore_time",
        "bloc_a/approaches": "approaches",

        "bloc_b/additionality": "additionality",
        "bloc_b/innovation_level": "innovation_level",
        "bloc_b/b1_explain": "b1_explain",
        "bloc_b/b2_explain": "b2_explain",
        "bloc_b/toc": "toc",

        "bloc_c/obstacles": "obstacles",
        "bloc_c/c1_solutions": "c1_solutions",
        "bloc_c/governance": "governance",
        "bloc_c/capacity": "capacity",
        "bloc_c/c4_coordination": "c4_coordination",

        "bloc_d/priority_areas": "priority_areas",
        "bloc_d/underserved": "underserved",
        "bloc_d/meca": "meca",
        "bloc_d/feedback_channel": "feedback_channel",
        "bloc_d/saddd": "saddd",
        "bloc_d/trust_plus": "trust_plus",
        "bloc_d/trust_minus": "trust_minus",

        "bloc_e/risks": "risks",
        "bloc_e/e1_mitigation": "e1_mitigation",
        "bloc_e/funds": "funds",
        "bloc_e/critical_need": "critical_need",
        "bloc_e/e3_results": "e3_results",

        "bloc_f/digital_adv": "digital_adv",
        "bloc_f/digital_lim": "digital_lim",
        "bloc_f/f1_strengthen": "f1_strengthen",
        "bloc_f/un_support": "un_support",
        "bloc_f/f2_details": "f2_details",
    }

    for k, v in rename_map.items():
        if k in df.columns and v not in df.columns:
            df.rename(columns={k: v}, inplace=True)

    return df


def ensure_label_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Tes scripts front utilisent des champs *_label.
    Si Kobo ne fournit pas ces champs, on les crée en fallback depuis la valeur brute.
    """
    pairs = [
        ("org_type", "org_type_label"),
        ("cluster", "cluster_label"),
        ("province", "province_label"),
        ("other_provinces", "other_provinces_label"),
        ("service_top1", "service_top1_label"),
        ("service_top2", "service_top2_label"),
        ("service_top3", "service_top3_label"),
        ("referral_gravity", "referral_gravity_label"),
        ("restore_time", "restore_time_label"),
        ("approaches", "approaches_label"),
        ("additionality", "additionality_label"),
        ("innovation_level", "innovation_level_label"),
        ("obstacles", "obstacles_label"),
        ("governance", "governance_label"),
        ("capacity", "capacity_label"),
        ("priority_areas", "priority_areas_label"),
        ("underserved", "underserved_label"),
        ("meca", "meca_label"),
        ("feedback_channel", "feedback_channel_label"),
        ("risks", "risks_label"),
        ("funds", "funds_label"),
        ("critical_need", "critical_need_label"),
        ("digital_adv", "digital_adv_label"),
        ("digital_lim", "digital_lim_label"),
        ("un_support", "un_support_label"),
        ("consent", "consent_label"),
    ]

    for raw, lab in pairs:
        if lab not in df.columns:
            if raw in df.columns:
                df[lab] = df[raw].apply(safe_str)
            else:
                df[lab] = ""

    # Convertit dates
    if "date_interview" in df.columns:
        df["date_interview"] = df["date_interview"].apply(safe_str)

    # Organisation string
    if "organisation" in df.columns:
        df["organisation"] = df["organisation"].apply(safe_str)

    if "admin2" in df.columns:
        df["admin2"] = df["admin2"].apply(safe_str)

    return df


def agg_counts(df: pd.DataFrame, col_label: str, multi: bool = False) -> Dict[str, int]:
    if col_label not in df.columns:
        return {}
    vals: List[str] = []
    if multi:
        for x in df[col_label].tolist():
            vals.extend(split_multi(x))
    else:
        vals = [safe_str(x) for x in df[col_label].tolist() if safe_str(x)]
    return count_series(vals)


def build_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Produit la structure attendue par main.js (scope.summary)
    """
    summary = {
        "total_responses": int(len(df)),
        "org_types": agg_counts(df, "org_type_label", multi=False),
        "clusters": agg_counts(df, "cluster_label", multi=True),
        "province_base": agg_counts(df, "province_label", multi=False),
        "other_provinces": agg_counts(df, "other_provinces_label", multi=True),

        # Bloc A
        "top_service_1": agg_counts(df, "service_top1_label", multi=False),
        "top_service_2": agg_counts(df, "service_top2_label", multi=False),
        "top_service_3": agg_counts(df, "service_top3_label", multi=False),
        "referral_gravity": agg_counts(df, "referral_gravity_label", multi=False),
        "restore_time": agg_counts(df, "restore_time_label", multi=False),
        "approaches": agg_counts(df, "approaches_label", multi=True),

        # Bloc B
        "additionality": agg_counts(df, "additionality_label", multi=True),
        "innovation_level": agg_counts(df, "innovation_level_label", multi=False),

        # Bloc C
        "obstacles_wlo": agg_counts(df, "obstacles_label", multi=True),
        "governance_mechanisms": agg_counts(df, "governance_label", multi=True),
        "capacity_needs": agg_counts(df, "capacity_label", multi=True),

        # Bloc D
        "priority_areas": agg_counts(df, "priority_areas_label", multi=True),
        "underserved_groups": agg_counts(df, "underserved_label", multi=True),
        "accountability_mechanisms": agg_counts(df, "meca_label", multi=True),
        "feedback_channel": agg_counts(df, "feedback_channel_label", multi=False),

        # Bloc E
        "operational_risks": agg_counts(df, "risks_label", multi=True),
        "funds_leverage": agg_counts(df, "funds_label", multi=True),
        "critical_need": agg_counts(df, "critical_need_label", multi=False),

        # Bloc F
        "digital_advantages": agg_counts(df, "digital_adv_label", multi=True),
        "digital_limits": agg_counts(df, "digital_lim_label", multi=True),
        "un_support": agg_counts(df, "un_support_label", multi=True),
    }
    return summary


def build_payload(df: pd.DataFrame) -> Dict[str, Any]:
    """
    data.json: { summary: {...}, by_org_type: { "WLO": {...}, ... } }
    """
    payload: Dict[str, Any] = {}
    payload["summary"] = build_summary(df)

    by_org: Dict[str, Any] = {}
    if "org_type_label" in df.columns:
        for org in sorted(set([safe_str(x) for x in df["org_type_label"].tolist() if safe_str(x)])):
            sub = df[df["org_type_label"] == org].copy()
            by_org[org] = build_summary(sub)
    payload["by_org_type"] = by_org
    return payload


def write_json(path: str, obj: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def main() -> None:
    raw_path = os.path.join("data", "raw.json")
    raw = load_json(raw_path)

    # Kobo raw.json dans notre fetch contient {"results":[...]}
    results = raw.get("results", [])
    if not isinstance(results, list):
        die("Format raw.json inattendu: 'results' doit être une liste.")

    df = df_from_results(results)
    df = ensure_label_columns(df)

    # records.json attendu par table.js : { records: [...] }
    records = df.fillna("").to_dict(orient="records")
    write_json("records.json", {"records": records})

    # data.json attendu par main.js
    payload = build_payload(df)
    write_json("data.json", payload)

    print(f"✅ records.json: {len(records)} lignes")
    print("✅ data.json: summary + by_org_type générés")


if __name__ == "__main__":
    main()
