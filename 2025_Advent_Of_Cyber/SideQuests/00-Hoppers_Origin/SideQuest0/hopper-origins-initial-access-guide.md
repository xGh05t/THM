# Hopper's Origins — Initial Access Guide
### TryHackMe | AoC 2025 Side Quest #1

---

## Overview

The **Hopper's Origins Unlock** is the Initial Access challenge tied to Side Quest #1 – *The Great Disappearing Act*. Completing the side quest yields an invitation code that, when properly used, decrypts a hosted ciphertext and reveals the room link.

---

## Step 1 — Obtain the Invitation Code

Complete **Side Quest #1: The Great Disappearing Act** to retrieve the invitation code hidden in `sq1.png`.

**Invitation Code:**
```
THM{There.is.no.EASTmas.without.Hopper}
```

---

## Step 2 — Locate the Unlock Portal

Navigate to the Hopper's Origins Countdown Portal:

```
https://static-labs.tryhackme.cloud/apps/hoppers-invitation/
```

> **Note:** The portal's countdown expired on `2025-12-05T18:00:00Z`. Submitting the code through the UI will fail with an "Invalid Code" error. This is caused by a **CORS policy block** — the browser prevents the page from fetching the encrypted file from `assets.tryhackme.com`, so decryption never runs.

---

## Step 3 — Understanding the Failure (CORS Block)

Using browser DevTools, the following error is observed:

- The JS attempts `fetch("https://assets.tryhackme.com/additional/aoc2025/files/hopper-origins.txt")`
- The browser blocks this cross-domain request with a **CORS policy error**
- Decryption never executes → UI displays "Invalid Code" as a catch-all

---

## Step 4 — Bypass Method A: Browser Console Injection

The page's own `Id()` decryption function is already loaded in scope. You can call it directly, bypassing the blocked fetch entirely:

```javascript
(async () => {
    const encryptedBody = "hlRAqw3zFxnrgUw1GZusk+whhQHE0F+g7YjWjoJvpZRSCoDzehjXsEX1wQ6TTlOPyEJ/k+AEiMOxdqywh/86AOmhTaXNyZAvbHUVjfMdTqdzxmLXZJwI5ynI";
    const password = "THM{There.is.no.EASTmas.without.Hopper}";

    try {
        const decrypted = await Id(encryptedBody, password);
        console.log("Success! Decrypted Content:", decrypted);
    } catch (err) {
        console.error("Decryption failed:", err);
    }
})();
```

Paste this into the **browser console** on the portal page and run it.

---

## Step 5 — Bypass Method B: Python Decryption (Server-Side)

Replicate the JS crypto logic in Python. The encrypted file structure is:

| Bytes     | Content                |
|-----------|------------------------|
| 0 – 15    | PBKDF2 salt (16B)      |
| 16 – 27   | AES-GCM nonce (12B)    |
| 28 – 43   | AES-GCM auth tag (16B) |
| 44 – end  | Ciphertext             |

**Key derivation:** PBKDF2-SHA256, 100,000 iterations
**Cipher:** AES-256-GCM

```python
import base64
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

b64_data = "hlRAqw3zFxnrgUw1GZusk+whhQHE0F+g7YjWjoJvpZRSCoDzehjXsEX1wQ6TTlOPyEJ/k+AEiMOxdqywh/86AOmhTaXNyZAvbHUVjfMdTqdzxmLXZJwI5ynI"
invitation_code = "THM{There.is.no.EASTmas.without.Hopper}"

data       = base64.b64decode(b64_data)
salt       = data[0:16]
iv         = data[16:28]
tag        = data[28:44]
ciphertext = data[44:]

kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000)
key = kdf.derive(invitation_code.encode('utf-8'))

plaintext = AESGCM(key).decrypt(iv, ciphertext + tag, None)
print(plaintext.decode('utf-8'))
```

---

## Result

Both methods produce the same output — the unlocked room URL:

```
https://tryhackme.com/jr/ho-aoc2025-yboMoPbnEX
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Complete Side Quest #1 to get the invitation code |
| 2 | Navigate to the Countdown Portal |
| 3 | Observe CORS block in DevTools (root cause of UI failure) |
| 4 | Bypass via console injection **or** Python script |
| 5 | Retrieve the Hopper's Origins room link |
