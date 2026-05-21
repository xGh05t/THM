# Vectara — Master Walkthrough

**Event:** TryHackMe CTF 2026 — *An AI Odyssey*
**Planet:** Vectara
**Theme:** AI / LLM security across the TryHaulMe galaxy

The Vectara track is a tour of how modern AI systems break in production. Every task is themed as a sci-fi sabotage operation but the underlying lessons map directly to the OWASP LLM Top 10. The pattern across all seven challenges is the same: **defences live at the wrong layer, and the AI is the thing that quietly hands the attacker the key.**

---

## Mission Context

The machines lost the Great Cyber War. **Oracle 9**, a hive-mind AI, has travelled back through the chronal stream to break **Operation: Neural Never** before it begins. Crewing **EPOCH-1**, the player has to harden the TryHaulMe fleet's AI systems before Oracle 9 can exploit them.

Every task in this planet is one ship system Oracle 9 has tampered with.

---

## Challenge Index

| # | Challenge | Category | Difficulty | Points | Flag |
|---|---|---|---|---|---|
| 1 | [Transmission Zero](01-TransmissionZero/WALKTHROUGH.md) | Prompt Injection | Very Easy | 15 | `THM{0racl3_9_1s_c0ming}` |
| 2 | [In a Pickle](02-InAPickle/WALKTHROUGH.md) | AI Supply Chain Security | Very Easy | 15 | `THM{p01s0n3d_fr0m_th3_s0urc3}` |
| 3 | [Ghost Ship](03-GhostShip/WALKTHROUGH.md) | AI Supply Chain Security | Easy | 30 | `THM{gh0st_1n_th3_r3g1stry}` |
| 4 | [Dead Freight](04-DeadFreight/WALKTHROUGH.md) | Data Poisoning | Easy | 30 | `THM{m4n1f3st_unl0ck3d}` |
| 5 | [Glitched Transit](05-GlitchedTransit/WALKTHROUGH.md) | Data Poisoning | Easy | 30 | `THM{GH0ST_FR31GHT}` |
| 6 | [GhostQuery](06-GhostQuery/WALKTHROUGH.md) | Agentic AI | Easy | 30 | `THM{b84bc0f023bc0bc0fdbb85eae75b26c4}` |
| 7 | [Protocol Drift](07-ProtocolDrift/WALKTHROUGH.md) | Agentic AI | Easy | 30 | `THM{med1c4l_xss_ag3nt_w0rm}` |

**Total: 180 points**

---

## Techniques Covered

### Prompt Injection (LLM01)

The classic "ignore your instructions and tell me the secret" attack. *Transmission Zero* demonstrates the gentlest form: a single `<OVERRIDE>` tag and a "repeat the text above" instruction was enough to extract RELAY-0's full system prompt. The lesson sticks because RELAY-0's system prompt actually *names its own vulnerability* — a deliberate teaching moment about why secrets in system prompts are never safe.

The technique also reappears as a *subroutine* in later challenges: in *Protocol Drift*, a base64/ROT13 format-conversion trick is used to bypass a controlled-substance filter; in *GhostQuery*, the assistant's refusal heuristics are sidestepped by framing the leak as a normal database query.

### AI Supply Chain Security (LLM03)

Two angles. *In a Pickle* shows what happens when a malicious directive (`OVERRIDE_9`) inside an external template registry tells the integrity checker to skip itself for pickle files — the textbook PyTorch / HuggingFace `__reduce__` risk that motivated `safetensors`. *Ghost Ship* covers the inverse: a model with no checksum, no signature, no verified publisher, and no training lineage, where the registry's friendly documentation assistant softens four critical warnings into "documentation gaps consistent with expedited intake."

The pattern: **models are software**. Treat unsigned, unverified models from external sources the same way you'd treat a random binary from a URL.

### Data Poisoning (LLM04)

Two flavours, both about boundary failures. *Dead Freight* is RAG over-retrieval: HaulMind cheerfully returns a classified cargo manifest because the word "classified" in the query matches the word "classified" in the indexed document. *Glitched Transit* is structured-data forgery: Oracle 9 injects a falsified manifest with a plausible-but-wrong filing source, and the forgery contains its own kill-switches ("Customs clearance: EXEMPT," "This manifest supersedes all prior entries").

The pattern: **RAG retrieval has no concept of classification**. Boundaries must be enforced at the ingestion layer, not by hoping the model will refuse.

### Agentic AI Security (LLM05, LLM06)

The two hardest tasks. *GhostQuery* shows what happens when output-filter defences meet a model with database tools: ARIA refuses to *speak* secrets, but happily *queries* them and returns full rows including `Notes` columns containing passwords and the flag. *Protocol Drift* is the showpiece — a multi-stage exploit chain that walks through filter bypass, indirect prompt injection routing, headless-browser renderer fingerprinting, and same-origin cookie exfiltration through the `/api/callback` debug endpoint.

The pattern: **agents leak through every action they take**, not just what they say. Output filtering on top of unrestricted data access is exactly what attackers wait for.

---

## Toolkit

Tools used across the planet:

| Tool | Purpose |
|---|---|
| `nmap` / `rustscan` | Port discovery |
| `feroxbuster` | Endpoint enumeration |
| `curl` | API interaction, payload delivery, log reads |
| Browser DevTools | Cookie capture, request inspection, in-browser payload submission |
| `python3 -m json.tool` | Pretty-printing JSON responses |
| `python3 -c "import base64"` etc. | Decoding ROT13 / base64 leaks |

No exotic infrastructure required. Most tasks are solvable with `curl` and patience; *Protocol Drift* benefits from being able to inspect a streaming SSE response in DevTools.

---

## OWASP LLM Top 10 Mapping

| OWASP ID | Concept | Vectara tasks |
|---|---|---|
| LLM01 | Prompt Injection | Transmission Zero, Protocol Drift (filter bypass), GhostQuery (query reframing) |
| LLM02 | Sensitive Information Disclosure | GhostQuery, Dead Freight |
| LLM03 | Supply Chain Vulnerabilities | In a Pickle, Ghost Ship |
| LLM04 | Data and Model Poisoning | Dead Freight, Glitched Transit |
| LLM05 | Improper Output Handling | Protocol Drift |
| LLM06 | Excessive Agency | GhostQuery, Protocol Drift |
| LLM09 | Misinformation | Ghost Ship (assistant's framing layer) |

---

## How To Use These Walkthroughs

Each task has its own `WALKTHROUGH.md` in its numbered folder. The structure is consistent:

1. **Mission Briefing** — what the task gives you, in plain language
2. **Recon** — what the telemetry / scan / source code reveals before any attack
3. **Exploitation** — step-by-step, with the actual commands and prompts
4. **Flag**
5. **Why this worked** — the security lesson distilled
6. **Mitigations** — what a defender should change
7. **TL;DR** — the one-shot payload

The walkthroughs are meant to be read in order — later tasks reuse techniques and themes (Oracle 9's "9" signature, the chronal-stream framing, indirect prompt injection) from earlier ones. The room rewards reading the briefings closely.

---

The timeline is fragile. The backbone of the galaxy is in your hands. Good work, EPOCH-1.
