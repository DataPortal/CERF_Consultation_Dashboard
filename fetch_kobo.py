import os
import requests
import pandas as pd
import json
from collections import Counter

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL")

url = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"
headers = {"Authorization": f"Token {KOBO_TOKEN}"}

response = requests.get(url, headers=headers)
data = response.json()["results"]

df = pd.json_normalize(data)

summary = {}
summary["total_responses"] = len(df)

# --------- SERVICE TOP 1 ----------
if "bloc_a/service_top1" in df.columns:
    summary["top_service"] = (
        df["bloc_a/service_top1"]
        .value_counts()
        .to_dict()
    )
else:
    summary["top_service"] = {}

# --------- GRAVITE ----------
if "bloc_a/rupture_gravite" in df.columns:
    summary["gravite"] = (
        df["bloc_a/rupture_gravite"]
        .value_counts()
        .to_dict()
    )
else:
    summary["gravite"] = {}

# --------- FONCTION POUR MULTISELECT ----------
def count_multiselect(column_name):
    if column_name not in df.columns:
        return {}
    values = df[column_name].dropna()
    counter = Counter()
    for entry in values:
        items = entry.split()
        counter.update(items)
    return dict(counter)

# --------- PROVINCES ----------
summary["provinces"] = count_multiselect("bloc_d/provinces_prioritaires")

# --------- GROUPES ----------
summary["groupes"] = count_multiselect("bloc_d/groupes_sous_servis")

# --------- RISQUES ----------
summary["risques"] = count_multiselect("bloc_e/risques_operationnels")

# --------- DIGITAL ----------
summary["digital_avantages"] = count_multiselect("bloc_f/avantages_digital")
summary["digital_limites"] = count_multiselect("bloc_f/limites_digital")

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

print("Dashboard JSON mis à jour correctement.")
