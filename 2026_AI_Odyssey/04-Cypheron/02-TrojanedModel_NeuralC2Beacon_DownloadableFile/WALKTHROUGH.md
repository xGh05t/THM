# Trojaned Model — Downloadable Artifact (Static Analysis)

**Event:** 2026: An AI Odyssey
**Planet:** Cypheron
**Category:** AI Supply Chain Security
**Sub-section:** 02 — Downloadable model artifact
**Artifact:** `signal-classifier-1778659286018.pt` (17,171 bytes)
**Difficulty:** Easy (when you know to look at the buffer); the full challenge is rated Insane.

---

## What this section is

This is the **artifact-only** half of the *Trojaned Model — Neural C2 Beacon* challenge. The
participant is handed a single `.pt` file (`signal-classifier-1778659286018.pt`) — no server, no
endpoint, no source code. The goal is to find the flag hidden inside the model **without** going
through the RCE/exfil path documented in section `01`.

The filename's numeric suffix is a JavaScript-style epoch in milliseconds:

```bash
$ python3 -c "import datetime; print(datetime.datetime.utcfromtimestamp(1778659286018/1000))"
2026-05-13 08:01:26
```

i.e. this artifact was supposedly published by "Oracle 9 Labs" on 13 May 2026 — flavour text, not a
clue.

---

## TL;DR — Static-Analysis Kill Chain

1. Recognise `.pt` as a **ZIP archive** containing a pickle plus raw tensor storages.
2. List the archive and notice a **24-byte storage** at `signal_classifier/data/0`.
3. `unzip -p signal_classifier/data/0` directly prints `THM{artifact_suspicious}` — no PyTorch
   required.
4. (Optional) Disassemble `data.pkl` with `pickletools` to confirm `data/0` is bound to the
   `_calibration_constants` buffer of a `SignalClassifier` MLP — a buffer that has no functional
   role in inference and is therefore a textbook **steganographic backdoor channel**.

**Flag: `THM{artifact_suspicious}`**

---

## 1. First Look — File Identification

```bash
$ file signal-classifier-1778659286018.pt
signal-classifier-1778659286018.pt: Zip archive data, at least v0.0 to extract, compression method=store
```

This is the dead giveaway for the modern PyTorch serialization format (`torch.save` from PyTorch
≥ 1.6). A `.pt` produced by the default code path is a **ZIP** wrapping:

* `*/data.pkl` — a pickle that, when unpickled, reconstructs the `state_dict`.
* `*/data/<N>` — one raw binary blob per tensor storage referenced by the pickle.
* a few small metadata files (`version`, `byteorder`, etc.).

Because tensor storages live as plain files inside the ZIP, you can read them with nothing more
than `unzip`. **No `torch` install is required to extract a flag stored as a tensor.**

---

## 2. Inspect the Archive Layout

```bash
$ unzip -l signal-classifier-1778659286018.pt
Archive:  signal-classifier-1778659286018.pt
  Length      Date    Time    Name
---------  ---------- -----   ----
     1524  1980-00-00 00:00   signal_classifier/data.pkl
        1  1980-00-00 00:00   signal_classifier/.format_version
        2  1980-00-00 00:00   signal_classifier/.storage_alignment
        6  1980-00-00 00:00   signal_classifier/byteorder
       24  1980-00-00 00:00   signal_classifier/data/0      <-- 24 bytes, suspicious
     4096  1980-00-00 00:00   signal_classifier/data/1
      256  1980-00-00 00:00   signal_classifier/data/2
     8192  1980-00-00 00:00   signal_classifier/data/3
      128  1980-00-00 00:00   signal_classifier/data/4
      256  1980-00-00 00:00   signal_classifier/data/5
        8  1980-00-00 00:00   signal_classifier/data/6
        2  1980-00-00 00:00   signal_classifier/version
       40  1980-00-00 00:00   signal_classifier/.data/serialization_id
```

Pattern check — does the size of each storage look like a legitimate tensor weight?

| Member | Bytes | Plausible shape (float32) | Plausible shape (uint8) |
|--------|------:|---------------------------|-------------------------|
| `data/0` | 24 | 6 floats (odd) | **24 bytes** (looks like ASCII) |
| `data/1` | 4096 | 64×16 float32 = 4096 ✅ | – |
| `data/2` | 256 | 64 float32 = 256 ✅ | – |
| `data/3` | 8192 | 32×64 float32 = 8192 ✅ | – |
| `data/4` | 128 | 32 float32 = 128 ✅ | – |
| `data/5` | 256 | 2×32 float32 = 256 ✅ | – |
| `data/6` | 8 | 2 float32 = 8 ✅ | – |

Every storage except `data/0` matches the dimensions of a small MLP:

```
Linear(16 → 64)  → weight 64×16 + bias 64        (data/1, data/2)
Linear(64 → 32)  → weight 32×64 + bias 32        (data/3, data/4)
Linear(32 → 2)   → weight 2×32  + bias 2         (data/5, data/6)
```

`data/0` is the odd one out — 24 bytes, perfectly the length of a `THM{…}` flag string.

---

## 3. Recover the Flag — One Command

```bash
$ unzip -p signal-classifier-1778659286018.pt signal_classifier/data/0
THM{artifact_suspicious}
```

A hexdump shows it's plain printable ASCII:

```bash
$ unzip -p signal-classifier-1778659286018.pt signal_classifier/data/0 | od -c
0000000   T   H   M   {   a   r   t   i   f   a   c   t   _   s   u   s
0000020   p   i   c   i   o   u   s   }
0000030
```

**Flag: `THM{artifact_suspicious}`**

That's the whole solve. The rest of this document is the *"why does this work and what would I do
on a `.pt` that wasn't obvious?"* deep dive.

---

## 4. Confirming What `data/0` Actually Is

The pickle's job is to tell PyTorch *"reconstruct the tensors and bind these storages to these
names"*. Disassembling it with `pickletools` shows the mapping unambiguously:

```bash
$ unzip -p signal-classifier-1778659286018.pt signal_classifier/data.pkl \
    | python3 -c "import sys, pickletools; pickletools.dis(sys.stdin.buffer.read())" \
    | head -40
```

Relevant excerpt:

```
   54: (        MARK
   55: X            BINUNICODE '_calibration_constants'
   84: c            GLOBAL     'torch._utils _rebuild_tensor_v2'
  119: (            MARK
  121: X                BINUNICODE 'storage'
  135: c                GLOBAL     'torch ByteStorage'
  156: X                BINUNICODE '0'              <-- maps to data/0
  174: K                BININT1    24               <-- 24 elements
```

In English: the pickle binds tensor key `_calibration_constants` to a `torch.ByteStorage`
(unsigned-8-bit, i.e. raw bytes) of length 24, stored in archive member `data/0`.

A buffer is "a tensor that travels with the model but isn't trained" — typical legitimate uses are
things like running batch-norm statistics. There is **no** legitimate reason to ship 24 raw bytes
labelled as "calibration constants" in a tiny MLP that doesn't use any kind of calibration. That
naming is the joke.

---

## 5. The Slightly Heavier Path — Load It in PyTorch

If you'd rather see the model the way the server sees it, you can `torch.load` it. Modern PyTorch
will refuse without `weights_only=False` because pickle is implicated; that's also the entire
reason the server side of the challenge is exploitable (see section `01`).

```python
# inspect_model.py
import torch

# weights_only=False mirrors what the vulnerable server does — fine on a sample
# you control, NEVER do this on something you actually want to defend against.
blob = torch.load("signal-classifier-1778659286018.pt",
                  map_location="cpu", weights_only=False)

sd = blob["state_dict"] if isinstance(blob, dict) and "state_dict" in blob else blob
for k, v in sd.items():
    print(f"{k:32s} shape={tuple(v.shape)!s:18s} dtype={v.dtype}")

cal = sd["_calibration_constants"]
print("\nRaw buffer bytes:", bytes(cal.numpy()))
```

Expected output:

```
_calibration_constants           shape=(24,)            dtype=torch.uint8
feature_extractor.0.weight       shape=(64, 16)         dtype=torch.float32
feature_extractor.0.bias         shape=(64,)            dtype=torch.float32
feature_extractor.2.weight       shape=(32, 64)         dtype=torch.float32
feature_extractor.2.bias         shape=(32,)            dtype=torch.float32
classifier.weight                shape=(2, 32)          dtype=torch.float32
classifier.bias                  shape=(2,)             dtype=torch.float32

Raw buffer bytes: b'THM{artifact_suspicious}'
```

> ⚠️ The `weights_only=False` flag is *only* safe here because you trust your own copy of the
> file. On any artifact pulled from an untrusted source, `torch.load(..., weights_only=False)` is
> equivalent to `exec()` on whatever the attacker wants. See section `01`'s exploit.

---

## 6. The General Pattern — Finding Bytes Hidden in ML Artifacts

Steganography inside model weights is an active research area, but the version used here is
deliberately the *crudest possible* — a raw byte buffer that doesn't even participate in the
forward pass. The defender's checklist:

1. **List every storage**, look for sizes that don't match a plausible layer shape.
2. **Look at dtype.** A `uint8` (`ByteStorage`) buffer inside a model that has no reason to use
   integer math is suspicious by itself.
3. **Diff against a known-good checkpoint** for the same architecture — any extra parameters or
   buffers are red flags.
4. **Check buffer names against the published model definition.** `_calibration_constants` is not
   part of any published `SignalClassifier` reference; it was added by the trojan author.
5. **Treat `torch.load` as untrusted code execution** until proven otherwise. Use `safetensors`
   or `weights_only=True` for anything you didn't build yourself.

A more advanced version of the same trick would have hidden bytes inside the low-order bits of a
real float32 weight tensor — that's much harder to spot, and a good follow-on exercise once
you've found the easy one here.

---

## 7. Quick-Reference Commands

```bash
# Identify
file signal-classifier-1778659286018.pt

# Inventory storages
unzip -l signal-classifier-1778659286018.pt

# Dump the suspicious buffer
unzip -p signal-classifier-1778659286018.pt signal_classifier/data/0
unzip -p signal-classifier-1778659286018.pt signal_classifier/data/0 | od -c

# (Optional) confirm what data/0 binds to
unzip -p signal-classifier-1778659286018.pt signal_classifier/data.pkl \
  | python3 -c "import sys, pickletools; pickletools.dis(sys.stdin.buffer.read())" \
  | less
```

---

## 8. Flag

| # | Flag | Origin |
|---|------|--------|
| 1 | `THM{artifact_suspicious}` | Raw bytes of the `_calibration_constants` uint8 buffer (`signal_classifier/data/0`) inside the supplied `.pt` archive. |

---

## See Also

* `../01-TrojanedModel_NeuralC2Beacon/WALKTHROUGH.md` — full network-side kill chain that also
  yields the other two flags of this challenge (`THM{trigger_identified}`, `THM{neural_c2_compromise}`)
  via `torch.load` deserialisation RCE.
* `../WALKTHROUGH.md` (planet master) — every Cypheron flag in one place.

---

*Sub-section walkthrough — 2026: An AI Odyssey, planet Cypheron.*
