import os
import sys

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, ServerSelectionTimeoutError

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "med_wholesale")

# Diagnostic-only escape hatch. Set MONGO_TLS_INSECURE=1 in .env to skip
# certificate verification and confirm whether antivirus/firewall TLS
# inspection is the cause. NEVER leave this on — see the guidance below.
TLS_INSECURE = os.getenv("MONGO_TLS_INSECURE", "0") == "1"

if not MONGO_URI:
    sys.exit(
        "MONGO_URI is not set. Copy .env.example to .env and paste in your "
        "MongoDB Atlas connection string before running the app."
    )

client_kwargs = {"serverSelectionTimeoutMS": 10000}
if TLS_INSECURE:
    client_kwargs["tlsAllowInvalidCertificates"] = True
    print("WARNING: MONGO_TLS_INSECURE=1 — certificate verification is OFF. "
          "Diagnostic use only, do not leave this set.")
else:
    # tlsCAFile=certifi.where() pins a known-good, up-to-date CA bundle
    # instead of the OS certificate store.
    client_kwargs["tlsCAFile"] = certifi.where()

try:
    client = MongoClient(MONGO_URI, **client_kwargs)
    db = client[DB_NAME]
    client.admin.command("ping")
    print(f"Connected to MongoDB Atlas — database '{DB_NAME}'")
except ConfigurationError as exc:
    sys.exit(
        f"MONGO_URI looks malformed: {exc}\n\n"
        "Double check the connection string in .env — it should look like:\n"
        "  mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
    )
except ServerSelectionTimeoutError as exc:
    is_tls_alert = "TLSV1_ALERT" in str(exc) or "SSL" in str(exc)

    if is_tls_alert:
        sys.exit(
            "Could not reach MongoDB Atlas — the TLS handshake itself is "
            "being rejected (SSL alert), not a certificate or credentials "
            "problem.\n\n"
            "This almost always means something between this machine and "
            "Atlas is intercepting HTTPS/TLS traffic:\n"
            "  1. Antivirus 'scan encrypted connections' / SSL inspection "
            "(Kaspersky, McAfee, Avast, ESET are the most common culprits). "
            "Turn this feature off, or add python.exe to its exceptions.\n"
            "  2. A corporate firewall or VPN doing TLS inspection.\n"
            "  3. To confirm the cause without changing antivirus settings: "
            "set MONGO_TLS_INSECURE=1 in .env and rerun. If it connects with "
            "that on, the cause is confirmed as TLS interception above, and "
            "you must fix it there — MONGO_TLS_INSECURE is not safe to leave "
            "on since it disables certificate verification.\n"
            "  4. Also try the same MONGO_URI in MongoDB Compass or "
            "`mongosh` — if those fail too, it confirms this is not "
            "specific to this app.\n"
            f"\nRaw error: {exc}"
        )

    sys.exit(
        "Could not reach MongoDB Atlas.\n"
        f"  {exc}\n\n"
        "Check, in order:\n"
        "  1. Atlas -> Network Access has your current IP allow-listed (or 0.0.0.0/0 for testing)\n"
        "  2. MONGO_URI in .env has the correct username/password and no stray characters\n"
        "  3. You are not on a network that blocks outbound port 27017"
    )