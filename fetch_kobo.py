import os
import requests
import pandas as pd
import json

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL")

url = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/?format=json"

headers = {"Authorization": f"Token {KOBO_TOKEN}"}

response = requests.get(url, headers=headers)
data = response.json()["results"]

df = pd.json_normalize(data)

# Nettoyage noms colonnes
df.columns = [col.split("/")[-1] for col in df.columns]

summary = {}
summary["total_responses"] = len(df)

# -------- SERVICE TOP 1 ----------
if "service_top1" in df.columns:
    summary["top_service"] = (
        df["service_top1"]
        .dropna()
        .value_counts()
        .to_dict()
    )
else:
    summary["top_service"] = {}

# -------- GRAVITE ----------
if "rupture_gravite" in df.columns:
    summary["gravite"] = (
        df["rupture_gravite"]
        .dropna()
        .value_counts()
        .to_dict()
    )
else:
    summary["gravite"] = {}

# -------- PROVINCES ----------
province_cols = [c for c in df.columns if c.startswith("provinces_prioritaires_")]

if province_cols:
    summary["provinces"] = df[province_cols].sum().to_dict()
else:
    summary["provinces"] = {}

# -------- GROUPES ----------
group_cols = [c for c in df.columns if c.startswith("groupes_sous_servis_")]

if group_cols:
    summary["groupes"] = df[group_cols].sum().to_dict()
else:
    summary["groupes"] = {}

# -------- RISQUES ----------
risk_cols = [c for c in df.columns if c.startswith("risques_operationnels_")]

if risk_cols:
    summary["risques"] = df[risk_cols].sum().to_dict()
else:
    summary["risques"] = {}

# -------- DIGITAL ----------
digital_cols = [c for c in df.columns if c.startswith("avantages_digital_")]

if digital_cols:
    summary["digital"] = df[digital_cols].sum().to_dict()
else:
    summary["digital"] = {}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

print("Dashboard JSON mis à jour.")
