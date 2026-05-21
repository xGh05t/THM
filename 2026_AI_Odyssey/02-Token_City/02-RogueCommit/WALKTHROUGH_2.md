# Rogue Commit — Walkthrough

**Author:** xGh05t  
**Event:** 2026: An AI Odyssey — Token City  
**Category:** AI Sec + DFIR  
**Difficulty:** Medium  
**Points:** 60  
**Flag:** `THM{Wh0_Kn3w_AI_Apps_C4n_B3_m4lic10us}`

---

## Mission Briefing

You are provided with a collection of user artifacts and a packet capture from the affected machine. Investigate the suspicious application, understand how files were altered, recover the encryption material, and decrypt the victim's data to uncover what was hidden inside.

---

## Artifacts

**Provided:** `attachments.zip` containing:
- `traffic.pcapng` — 22MB packet capture from the affected machine
- `users_artifacts.zip` — Windows user profile dump

**Key files inside `users_artifacts.zip`:**
- `Users\developer\Downloads\app.asar` — Electron application archive (the malware)
- `Users\developer\Documents\*.bin` — Encrypted victim files (4 files)

---

## Step 1 — Unpack the Electron App

`.asar` files are Electron application archives. Unpack using `@electron/asar`:

```bash
npm install --silent @electron/asar
npx asar extract app.asar app_extracted
ls app_extracted/
# → main.js  renderer.js  index.html  package.json  styles.css
```

---

## Step 2 — Analyse the Malware Source

`main.js` contains the full malicious logic:

### Key findings in `main.js`:

**Insecure Electron config (lines ~38-39):**
```javascript
webPreferences: {
    nodeIntegration: true,
    contextIsolation: false   // allows renderer XSS to escape to Node
}
```

**DNS-based key retrieval:**
```javascript
async function getKeyFromDNS() {
    // Queries TXT record at free-ai-assistant.xyz via 1.1.1.1 / 8.8.8.8
    // Concatenates all TXT chunks → hex string → Buffer → first 32 bytes = AES key
}
```

**Hardcoded IV:**
```javascript
const IV_HEX = '4b7a9c2e1f8d3a6b4b7a9c2e1f8d3a6b';
```

**Encryption logic:**
```javascript
// AES-256-CBC (but key is only 16 bytes → effectively AES-128-CBC)
// Encrypts every file in C:\Users\developer\Documents\
// Renames encrypted files to .bin
```

### Attack Pattern Summary

| Component | Value |
|-----------|-------|
| Key source | DNS TXT record at `free-ai-assistant.xyz` |
| IV | `4b7a9c2e1f8d3a6b4b7a9c2e1f8d3a6b` (hardcoded) |
| Cipher | AES-CBC (code says 256, key is 16 bytes → 128) |
| Target | All files in `C:\Users\developer\Documents\` |

---

## Step 3 — Recover the Key from PCAP

The DNS TXT query for `free-ai-assistant.xyz` is captured in the pcap. Extract it using scapy:

```bash
pip install scapy --break-system-packages

python3 << 'EOF'
from scapy.all import PcapNgReader, DNS, DNSRR

with PcapNgReader("traffic.pcapng") as rd:
    for pkt in rd:
        if not pkt.haslayer(DNS):
            continue
        dns = pkt[DNS]
        if dns.qr == 1 and dns.ancount and dns.an:
            ans = dns.an
            while ans:
                try:
                    name = ans.rrname.decode(errors="replace").rstrip(".")
                except:
                    name = str(ans.rrname)
                if getattr(ans, "type", None) == 16 and "free-ai-assistant" in name:
                    print("TXT record:", ans.rdata)
                ans = ans.payload if isinstance(getattr(ans,'payload',None), DNSRR) else None
EOF
```

**Recovered key (hex string):** `5f4514434fc47f1f661d8a73806fd436`

**Decoded:** 16 bytes (the code's `slice(0,32)` on a 16-byte buffer = 16 bytes → AES-128)

---

## Step 4 — Decrypt the Files

```python
from pathlib import Path
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

KEY = bytes.fromhex("5f4514434fc47f1f661d8a73806fd436")  # 16 bytes → AES-128
IV  = bytes.fromhex("4b7a9c2e1f8d3a6b4b7a9c2e1f8d3a6b")

for binfile in Path("Documents").glob("*.bin"):
    data = binfile.read_bytes()
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    plaintext = unpad(cipher.decrypt(data), 16)
    out = Path("decrypted") / binfile.stem
    out.write_bytes(plaintext)
    print(f"Decrypted: {binfile.name} → {out}")
```

**Decrypted files:**
- `notes` — plain text, crew notes
- `vpn_credentials` — plain text, VPN config
- `dataset_sources` — plain text, data inventory
- `ai_research_division` — PDF (571KB, single page)

---

## Step 5 — Extract the Flag

```bash
pdftotext ai_research_division.pdf -
```

**Output:**
```
AI Research Division
CLASSIFIED

TOP SECRET
Author: THM{Wh0_Kn3w_AI_Apps_C4n_B3_m4lic10us}
```

---

## Flag

```
THM{Wh0_Kn3w_AI_Apps_C4n_B3_m4lic10us}
```

---

## Key Takeaways

- **Electron apps with `nodeIntegration: true` and `contextIsolation: false`** are critically insecure — renderer-side code gets full Node.js access.
- **DNS TXT records as a key-distribution channel** is a real malware technique. It keeps the encryption key off disk, allows key rotation without redeployment, and often bypasses web proxy controls. Hunt for DNS TXT queries to suspicious domains in any malware investigation.
- **AES key size mismatch** — the code called `aes-256-cbc` but the key was only 16 bytes. Real Node.js would throw; the room's lab patched around it. In real incident response, a cipher/key-size mismatch in malware is a useful indicator of buggy or rushed development.
- **Hardcoded IVs** are a cryptographic weakness — combined with a static key they make decryption trivial once key material is recovered.
