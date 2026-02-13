import os
import requests
import pandas as pd
import json

KOBO_TOKEN = os.getenv("KOBO_TOKEN")
ASSET_ID = os.getenv("KOBO_ASSET_ID")
BASE_URL = os.getenv("KOBO_API_URL")

url = f"{BASE_URL}/api/v2/assets/{ASSET_ID}/data/"
headers = {"Authorization": f"Token {KOBO_TOKEN}"}

response = requests.get(url, headers=headers)
data = response.json()["results"]

df = pd.json_normalize(data)

# -------- DEBUG (optional first run) ----------
print("Colonnes disponibles :", df.columns.tolist())

summary = {}
summary["total_responses"] = len(df)

# ---- SERVICE TOP 1 ----
if "service_top1" in df.columns:
    summary["top_service"] = df["service_top1"].value_counts().to_dict()
else:
    summary["top_service"] = {}

# ---- PROVINCES PRIORITAIRES ----
province_cols = [c for c in df.columns if c.startswith("provinces_prioritaires/")]
summary["provinces_priority"] = df[province_cols].sum().to_dict()

# ---- RISQUES ----
risk_cols = [c for c in df.columns if c.startswith("risques_operationnels/")]
summary["risks"] = df[risk_cols].sum().to_dict()

# ---- DIGITAL ----
digital_cols = [c for c in df.columns if c.startswith("avantages_digital/")]
summary["digital_advantages"] = df[digital_cols].sum().to_dict()

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
