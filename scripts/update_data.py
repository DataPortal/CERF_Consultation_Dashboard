#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
from datetime import datetime, timezone
from collections import Counter, defaultdict

import pandas as pd


# -----------------------------
# Helpers
# -----------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def safe_str(v):
    if v is None:
        return ""
    if isinstance(v, (int, float)):
        return str(v)
    return str(v).strip()


def split_multi(v):
    """
    Accept:
    - list
    - "a, b, c"
    - "a; b; c"
    - "a b c" (when Kobo stores space-separated for select_multiple)
    """
    if v is None:
        return []
    if isinstance(v, list):
        return [safe_str(x) for x in v if safe_str(x)]
    s = safe_str(v)
    if not s:
        return []
    # Prefer comma/semicolon, fallback to spaces
    if "," in s:
        parts = [p.strip() for p in s.split(",")]
    elif ";" in s:
        parts = [p.strip() for p in s.split(";")]
    else:
        # Kobo select_multiple usually "a b c" (space-separated)
        parts = [p.strip() for p in s.split()]
    return [p for p in parts if p]


def map_label(group_map: dict, code_or_label: str):
    """
    Map known codes -> labels using labels.json.
    If already a human label, keep it.
    """
    s = safe_str(code_or_label)
    if not s:
        return ""
    # Exact code mapping
    if s in group_map:
        return group_map[s]
    return s


def normalize_org_type(raw_val: str, labels):
    """
    Your records sometimes have: nngo / Organisation conduite par des femmes (WLO) / ONG nationale...
    Normalize to a readable label.
    """
    s = safe_str(raw_val)
    if not s:
        return ""

    s_low = s.lower()

    # common noisy variants
    if s_low in ("nngo", "ong_nationale", "ong nationale", "ong nat", "national ngo"):
        return labels["org_type"]["ong_nat"]
    if s_low in ("ingo", "ong_internationale", "ong internationale", "international ngo"):
        return labels["org_type"]["ong_int"]
    if "wlo" in s_low or "organisation conduite par des femmes" in s_low:
        return labels["org_type"]["wlo"]
    if "agence" in s_low and ("onu" in s_low or "nations unies" in s_low):
        return labels["org_type"]["agence_onu"]
    if "gouvern" in s_low or "autorité" in s_low:
        return labels["org_type"]["gouvernement"]

    # If it matches one of labels values already, keep it
    if s in labels["org_type"].values():
        return s

    return s


def normalize_province(raw_val: str, labels):
    s = safe_str(raw_val)
    if not s:
        return ""
    s_low = s.lower().replace("-", "_").replace(" ", "_")
    # if already proper label (Nord-Kivu), keep it
    if s in labels["province"].values():
        return s
    # try code mapping
    if s_low in labels["province"]:
        return labels["province"][s_low]
    # try normalize "Nord-Kivu" => "nord_kivu"
    s_low2 = re.sub(r"[^a-z_]", "", s_low)
    if s_low2 in labels["province"]:
        return labels["province"][s_low2]
    return s


def counter_from_series(values):
    c = Counter([v for v in values if safe_str(v)])
    # stable sort: by count desc then label asc
    return dict(sorted(c.items(), key=lambda kv: (-kv[1], kv[0].lower())))


def counter_from_multis(values_list):
    flat = []
    for v in values_list:
        flat.extend(split_multi(v))
    c = Counter([v for v in flat if safe_str(v)])
    return dict(sorted(c.items(), key=lambda kv: (-kv[1], kv[0].lower())))


# -----------------------------
# Transform rows -> clean records
# -----------------------------
def make_records(raw_rows, labels):
    out = []

    for r in raw_rows:
        # You can adapt these keys to your Kobo form fields if needed.
        # Here we try to support both already-clean records.json and raw Kobo records.
        rec = {}

        # Dates
        rec["date_interview"] = safe_str(
            r.get("date_interview") or r.get("intro/date_interview") or r.get("start") or ""
        )[:10]

        # Org
        rec["organisation"] = safe_str(r.get("organisation") or r.get("intro/organisation") or "")

        # Org type
        raw_org_type = r.get("org_type_label") or r.get("intro/org_type") or r.get("org_type") or ""
        rec["org_type_label"] = normalize_org_type(raw_org_type, labels)

        # Cluster(s)
        rec["cluster_label"] = safe_str(r.get("cluster_label") or r.get("intro/cluster") or "")

        # Province base
        raw_prov = r.get("province_label") or r.get("intro/province") or ""
        rec["province_label"] = normalize_province(raw_prov, labels)

        # Admin2
        rec["admin2"] = safe_str(r.get("admin2") or r.get("intro/admin2") or "")

        # Other provinces (keep as label string)
        rec["other_provinces_label"] = safe_str(r.get("other_provinces_label") or r.get("intro/other_provinces") or "")

        # Consent
        rec["consent_label"] = safe_str(r.get("consent_label") or r.get("intro/consent") or "")

        # Services Top1/2/3
        rec["service_top1_label"] = safe_str(r.get("service_top1_label") or r.get("bloc_a/a1_service_top1") or "")
        rec["service_top2_label"] = safe_str(r.get("service_top2_label") or r.get("bloc_a/a1_service_top2") or "")
        rec["service_top3_label"] = safe_str(r.get("service_top3_label") or r.get("bloc_a/a1_service_top3") or "")

        # Where
        rec["a1_where"] = safe_str(r.get("a1_where") or r.get("bloc_a/a1_where") or "")
        rec["a2_where"] = safe_str(r.get("a2_where") or r.get("bloc_a/a2_where") or "")

        # Gravité / restore
        rec["referral_gravity_label"] = safe_str(r.get("referral_gravity_label") or r.get("bloc_a/a2_gravity") or "")
        rec["restore_time_label"] = safe_str(r.get("restore_time_label") or r.get("bloc_a/a3_restore_time") or "")

        # Approaches
        rec["approaches_label"] = safe_str(r.get("approaches_label") or r.get("bloc_a/a4_approaches") or "")

        # Additionality / innovation / ToC
        rec["additionality_label"] = safe_str(r.get("additionality_label") or r.get("bloc_b/b1_additionality") or "")
        rec["b1_explain"] = safe_str(r.get("b1_explain") or r.get("bloc_b/b1_explain") or "")
        rec["innovation_level_label"] = safe_str(r.get("innovation_level_label") or r.get("bloc_b/b2_innovation") or "")
        rec["b2_explain"] = safe_str(r.get("b2_explain") or r.get("bloc_b/b2_explain") or "")
        rec["toc"] = safe_str(r.get("toc") or r.get("bloc_b/b3_toc") or "")

        # Obstacles / solutions / governance / capacity / coordination
        rec["obstacles_label"] = safe_str(r.get("obstacles_label") or r.get("bloc_c/c1_obstacles") or "")
        rec["c1_solutions"] = safe_str(r.get("c1_solutions") or r.get("bloc_c/c1_solutions") or "")
        rec["governance_label"] = safe_str(r.get("governance_label") or r.get("bloc_c/c2_governance") or "")
        rec["capacity_label"] = safe_str(r.get("capacity_label") or r.get("bloc_c/c3_capacity") or "")
        rec["c4_coordination"] = safe_str(r.get("c4_coordination") or r.get("bloc_c/c4_coordination") or "")

        # Priority areas / underserved / SADD / AAP
        rec["priority_areas_label"] = safe_str(r.get("priority_areas_label") or r.get("bloc_d/d1_priority_areas") or "")
        rec["underserved_label"] = safe_str(r.get("underserved_label") or r.get("bloc_d/d2_underserved") or "")
        rec["saddd"] = safe_str(r.get("saddd") or r.get("bloc_d/d3_saddd") or "")
        rec["meca_label"] = safe_str(r.get("meca_label") or r.get("bloc_d/d4_meca") or "")
        rec["feedback_channel_label"] = safe_str(r.get("feedback_channel_label") or r.get("bloc_d/d5_feedback_channel") or "")
        rec["trust_plus"] = safe_str(r.get("trust_plus") or r.get("bloc_d/d6_trust_plus") or "")
        rec["trust_minus"] = safe_str(r.get("trust_minus") or r.get("bloc_d/d7_trust_minus") or "")

        # Risks / funds / results / critical need
        rec["risks_label"] = safe_str(r.get("risks_label") or r.get("bloc_e/e1_risks") or "")
        rec["e1_mitigation"] = safe_str(r.get("e1_mitigation") or r.get("bloc_e/e1_mitigation") or "")
        rec["funds_label"] = safe_str(r.get("funds_label") or r.get("bloc_e/e2_funds") or "")
        rec["e3_results"] = safe_str(r.get("e3_results") or r.get("bloc_e/e3_results") or "")
        rec["critical_need_label"] = safe_str(r.get("critical_need_label") or r.get("bloc_e/e4_critical_need") or "")

        # Digital
        rec["digital_adv_label"] = safe_str(r.get("digital_adv_label") or r.get("bloc_f/f1_digital_adv") or "")
        rec["digital_lim_label"] = safe_str(r.get("digital_lim_label") or r.get("bloc_f/f2_digital_lim") or "")
        rec["f1_strengthen"] = safe_str(r.get("f1_strengthen") or r.get("bloc_f/f3_strengthen") or "")
        rec["un_support_label"] = safe_str(r.get("un_support_label") or r.get("bloc_f/f4_un_support") or "")
        rec["f2_details"] = safe_str(r.get("f2_details") or r.get("bloc_f/f5_details") or "")

        out.append(rec)

    return out


# -----------------------------
# Build aggregations for main.js
# -----------------------------
def build_scope(df: pd.DataFrame):
    # Basic totals
    scope = {}
    scope["total_responses"] = int(len(df))

    # Intro charts
    scope["org_types"] = counter_from_series(df["org_type_label"].tolist())
    scope["clusters"] = counter_from_series(df["cluster_label"].tolist())
    scope["province_base"] = counter_from_series(df["province_label"].tolist())
    scope["other_provinces"] = counter_from_multis(df["other_provinces_label"].tolist())

    # Bloc A
    scope["top_service_1"] = counter_from_series(df["service_top1_label"].tolist())
    scope["top_service_2"] = counter_from_series(df["service_top2_label"].tolist())
    scope["top_service_3"] = counter_from_series(df["service_top3_label"].tolist())
    scope["referral_gravity"] = counter_from_series(df["referral_gravity_label"].tolist())
    scope["restore_time"] = counter_from_series(df["restore_time_label"].tolist())
    scope["approaches"] = counter_from_multis(df["approaches_label"].tolist())

    # Bloc B
    scope["additionality"] = counter_from_multis(df["additionality_label"].tolist())
    scope["innovation_level"] = counter_from_series(df["innovation_level_label"].tolist())

    # Bloc C
    scope["obstacles_wlo"] = counter_from_multis(df["obstacles_label"].tolist())
    scope["governance_mechanisms"] = counter_from_multis(df["governance_label"].tolist())
    scope["capacity_needs"] = counter_from_multis(df["capacity_label"].tolist())

    # Bloc D
    scope["priority_areas"] = counter_from_multis(df["priority_areas_label"].tolist())
    scope["underserved_groups"] = counter_from_multis(df["underserved_label"].tolist())
    scope["accountability_mechanisms"] = counter_from_multis(df["meca_label"].tolist())
    scope["feedback_channel"] = counter_from_series(df["feedback_channel_label"].tolist())

    # Bloc E
    scope["operational_risks"] = counter_from_multis(df["risks_label"].tolist())
    scope["funds_leverage"] = counter_from_multis(df["funds_label"].tolist())
    scope["critical_need"] = counter_from_series(df["critical_need_label"].tolist())

    # Bloc F
    scope["digital_advantages"] = counter_from_multis(df["digital_adv_label"].tolist())
    scope["digital_limits"] = counter_from_multis(df["digital_lim_label"].tolist())
    scope["un_support"] = counter_from_multis(df["un_support_label"].tolist())

    return scope


def main():
    labels = load_json("labels.json")
    raw = load_json("kobo_raw.json")

    raw_rows = raw.get("results") or []
    records = make_records(raw_rows, labels)

    # records.json for table/card views
    records_payload = {
        "generated_at": now_iso(),
        "records": records
    }
    save_json("records.json", records_payload)

    # data.json for charts / KPIs
    df = pd.DataFrame(records)

    summary = build_scope(df)

    by_org_type = {}
    for org_type, sub in df.groupby("org_type_label"):
        by_org_type[org_type] = build_scope(sub)

    data_payload = {
        "generated_at": now_iso(),
        "summary": summary,
        "by_org_type": by_org_type
    }
    save_json("data.json", data_payload)

    print("✅ Wrote records.json + data.json")
    print("   records:", len(records))


if __name__ == "__main__":
    main()
