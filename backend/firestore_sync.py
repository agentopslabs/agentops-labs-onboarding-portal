import os
import json
import requests

# Load config
config_path = os.path.join(os.getcwd(), "firebase-applet-config.json")
firebase_config = {}
if os.path.exists(config_path):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            firebase_config = json.load(f)
    except Exception as e:
        print(f"[Python Sync] Error loading firebase-applet-config.json: {e}")

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", firebase_config.get("projectId"))
DATABASE_ID = os.environ.get("FIREBASE_FIRESTORE_DATABASE_ID", firebase_config.get("firestoreDatabaseId", "(default)"))

collections_info = [
    {"name": "users", "key": "users", "type": "array"},
    {"name": "passwords", "key": "passwords", "type": "map"},
    {"name": "applications", "key": "applications", "type": "array"},
    {"name": "documents", "key": "documents", "type": "array"},
    {"name": "tests", "key": "tests", "type": "array"},
    {"name": "assignedTests", "key": "assignedTests", "type": "array"},
    {"name": "checklists", "key": "checklists", "type": "array"},
    {"name": "activityLogs", "key": "activityLogs", "type": "array"},
    {"name": "emails", "key": "emails", "type": "array"},
    {"name": "notifications", "key": "notifications", "type": "array"},
    {"name": "annotations", "key": "annotations", "type": "array"},
    {"name": "messages", "key": "messages", "type": "array"},
    {"name": "tasks", "key": "tasks", "type": "array"},
    {"name": "taskSubmissions", "key": "taskSubmissions", "type": "array"},
    {"name": "attendance", "key": "attendance", "type": "array"},
    {"name": "leaves", "key": "leaves", "type": "array"}
]

def parse_firestore_value(val):
    if "stringValue" in val:
        return val["stringValue"]
    if "integerValue" in val:
        return int(val["integerValue"])
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "booleanValue" in val:
        return val["booleanValue"]
    if "arrayValue" in val:
        values = val["arrayValue"].get("values", [])
        return [parse_firestore_value(v) for v in values]
    if "mapValue" in val:
        fields = val["mapValue"].get("fields", {})
        return {k: parse_firestore_value(v) for k, v in fields.items()}
    if "nullValue" in val:
        return None
    return None

def parse_firestore_doc(doc):
    fields = doc.get("fields", {})
    parsed = {}
    for k, v in fields.items():
        parsed[k] = parse_firestore_value(v)
    return parsed

def to_firestore_value(val):
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
    return {"nullValue": None}

def to_firestore_doc(fields_dict):
    return {"fields": {k: to_firestore_value(v) for k, v in fields_dict.items()}}

def get_item_id(item, col_name):
    if col_name == "applications":
        return item.get("employeeId")
    return item.get("id")

def load_from_firestore(db_state):
    if not PROJECT_ID:
        print("[Python Sync] Project ID missing, bypassing Firestore load.")
        return False
    
    print("[Python Sync] Downloading database from Firestore in parallel...")
    from concurrent.futures import ThreadPoolExecutor
    
    def load_collection(col):
        col_name = col["name"]
        col_key = col["key"]
        col_type = col["type"]
        url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/{col_name}?pageSize=1000"
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                documents = data.get("documents", [])
                if col_type == "array":
                    parsed_docs = [parse_firestore_doc(d) for d in documents]
                else:
                    parsed_docs = {}
                    for d in documents:
                        parsed = parse_firestore_doc(d)
                        doc_id = d.get("name", "").split("/")[-1]
                        if doc_id:
                            parsed_docs[doc_id] = parsed.get("password", "")
                return col_key, parsed_docs, True
            else:
                return col_key, ([] if col_type == "array" else {}), False
        except Exception as e:
            print(f"[Python Sync] Failed to load collection {col_name}: {e}")
            return col_key, ([] if col_type == "array" else {}), False

    loaded_any = False
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(load_collection, collections_info)
        
    for col_key, parsed_data, success in results:
        if success:
            db_state[col_key] = parsed_data
            loaded_any = True
        else:
            if col_key not in db_state or not db_state[col_key]:
                db_state[col_key] = parsed_data
                
    return loaded_any

def sync_to_firestore(db_state, target_collection=None):
    if not PROJECT_ID:
        print("[Python Sync] Project ID missing, bypassing Firestore sync.")
        return
    
    print(f"[Python Sync] Syncing database to Firestore in parallel (target={target_collection or 'all'})...")
    from concurrent.futures import ThreadPoolExecutor
    
    # Filter collections based on target_collection if provided
    collections_to_sync = collections_info
    if target_collection:
        collections_to_sync = [c for c in collections_info if c["name"] == target_collection or c["key"] == target_collection]
        
    def sync_collection(col):
        col_name = col["name"]
        col_key = col["key"]
        col_type = col["type"]
        
        # Get existing IDs and documents from Firestore
        url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/{col_name}?pageSize=1000"
        existing_ids = set()
        existing_docs = {}
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                documents = data.get("documents", [])
                for d in documents:
                    doc_id = d.get("name", "").split("/")[-1]
                    if doc_id:
                        existing_ids.add(doc_id)
                        existing_docs[doc_id] = parse_firestore_doc(d)
        except Exception as e:
            print(f"[Python Sync] Failed to scan existing IDs for {col_name}: {e}")

        # Sync items
        try:
            if col_type == "array":
                items = db_state.get(col_key) or []
                present_ids = set()
                
                # Write/update items
                for item in items:
                    doc_id = get_item_id(item, col_name)
                    if doc_id:
                        present_ids.add(doc_id)
                        existing_item = existing_docs.get(doc_id)
                        if existing_item == item:
                            continue  # Skip patch, they are identical!
                            
                        doc_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/{col_name}/{doc_id}"
                        payload = to_firestore_doc(item)
                        requests.patch(doc_url, json=payload, timeout=5)
                
                # Delete removed items
                for ext_id in existing_ids:
                    if ext_id not in present_ids:
                        doc_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/{col_name}/{ext_id}"
                        requests.delete(doc_url, timeout=5)
            else:
                # Passwords mapping
                passwords = db_state.get(col_key) or {}
                present_ids = set(passwords.keys())
                
                # Write/update passwords
                for user_id, pwd in passwords.items():
                    existing_pwd = existing_docs.get(user_id, {}).get("password")
                    if existing_pwd == pwd:
                        continue  # Skip patch, password matches!
                        
                    doc_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/{col_name}/{user_id}"
                    payload = to_firestore_doc({"id": user_id, "password": pwd})
                    requests.patch(doc_url, json=payload, timeout=5)
                
                # Delete removed passwords
                for ext_id in existing_ids:
                    if ext_id not in present_ids:
                        doc_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/{col_name}/{ext_id}"
                        requests.delete(doc_url, timeout=5)
        except Exception as e:
            print(f"[Python Sync] Failed to sync collection {col_name}: {e}")

    with ThreadPoolExecutor(max_workers=8) as executor:
        # Consume iterator to block until all threads finish
        list(executor.map(sync_collection, collections_to_sync))
        
    print("[Python Sync] Database sync completed.")
