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

# ---- INDICATEURS ----

summary = {}

summary["total_responses"] = len(df)

summary["top_service"] = (
    df["Service SSR/VBG le plus interrompu (Top 1)"]
    .value_counts()
    .to_dict()
)

province_cols = [c for c in df.columns if "Quelles provinces devraient être prioritaires ?/" in c]
summary["provinces_priority"] = df[province_cols].sum().to_dict()

risk_cols = [c for c in df.columns if "Principaux risques opérationnels./" in c]
summary["risks"] = df[risk_cols].sum().to_dict()

digital_cols = [c for c in df.columns if "Avantages potentiels des outils digitaux" in c]
summary["digital_advantages"] = df[digital_cols].sum().to_dict()

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
