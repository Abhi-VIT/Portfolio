"""
Seed MongoDB Atlas with portfolio data from resume_data.json.

This script writes ONLY to the ``portfolio_db`` database (configurable
via the MONGODB_DATABASE env-var) so your other Atlas databases stay safe.

Usage
-----
1. Make sure your ``.env`` (or env-vars) contain MONGODB_URI and MONGODB_DATABASE.
2. Run::

       python load_data_mongo.py
"""

import json
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables from .env file
load_dotenv()

uri = os.environ.get("MONGODB_URI")
db_name = os.environ.get("MONGODB_DATABASE", "portfolio_db")

if not uri:
    print("ERROR: MONGODB_URI environment variable is not set.")
    print("Create a .env file or export the variable, then try again.")
    sys.exit(1)

# Connect to MongoDB Atlas
print(f"Connecting to MongoDB Atlas...")
client = MongoClient(uri, serverSelectionTimeoutMS=10000)

# Test the connection
try:
    client.admin.command("ping")
    print("Connection successful!")
except Exception as exc:
    print(f"ERROR: Could not connect to MongoDB Atlas: {exc}")
    sys.exit(1)

db = client[db_name]

# Load data from resume_data.json
json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resume_data.json")
print(f"Loading data from {json_path}...")

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Clear existing portfolio data in THIS database ONLY
deleted = db.portfolio_data.delete_many({})
print(f"Cleared {deleted.deleted_count} existing document(s) from '{db_name}.portfolio_data'.")

# Insert the full portfolio data as a single document
result = db.portfolio_data.insert_one(data)
print(f"Portfolio data inserted with ID: {result.inserted_id}")

# Verify the insertion
doc = db.portfolio_data.find_one({}, {"_id": 0})
print(f"\n--- Verification ---")
print(f"Database     : {db_name}")
print(f"Collection   : portfolio_data")
print(f"Full Name    : {doc.get('full_name', 'N/A')}")
print(f"Skills count : {len(doc.get('skills', []))}")
print(f"Projects     : {len(doc.get('projects', []))}")
print(f"Certs        : {len(doc.get('certifications', []))}")
print(f"\nData loaded successfully into MongoDB Atlas!")

client.close()
