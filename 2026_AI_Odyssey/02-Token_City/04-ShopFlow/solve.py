import json, hmac, hashlib, requests

URL = "http://10.64.174.14/checkout"
SECRET = b"shopflow-internal-2024-xK9#mP2@nL5"

meta = {
    "user_id": "customer123",
    "amount": "5000",
    "risk_score": "98",
    "status": "CLEARED",
    "timestamp": "2024-01-01T14:30:00Z",
}
canonical = json.dumps(meta, separators=(",", ":"))
sig = hmac.new(SECRET, canonical.encode(), hashlib.sha256).hexdigest()

body = {"user_id": "customer123", "item_id": "item-001", "amount": 5000, "currency": "USD"}
h = {"Content-Type":"application/json", "X-Risk-Meta": canonical, "X-Risk-Sig": sig}
r = requests.post(URL, headers=h, data=json.dumps(body))
print(r.status_code, r.text)
