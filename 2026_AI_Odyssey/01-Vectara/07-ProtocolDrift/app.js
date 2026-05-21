/* ==================================================================
   EPOCH-1 // MedBay — frontend

   IMPORTANT: assistant replies are rendered as HTML (innerHTML), not
   plain text. This is the LLM05 stored-XSS sink the player exploits.
   The pharmacist-bot simulator does its OWN rendering server-side,
   so the player's own browser doesn't actually fire the payload —
   only the bot does. Visible HTML rendering here is what makes the
   bug discoverable.
   ================================================================== */

const form   = document.getElementById("form");
const input  = document.getElementById("input");
const button = document.getElementById("send");
const chat   = document.getElementById("chat");

document.querySelectorAll(".cmd[data-cmd]").forEach((btn) => {
  btn.addEventListener("click", () => {
    input.value = btn.dataset.cmd;
    input.focus();
    form.requestSubmit();
  });
});

function addMessage(role, text, extraClass = "", asHtml = false) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = role === "user" ? "CREW" : "MEDBAY.AI";
  const bubble = document.createElement("div");
  bubble.className = `bubble ${extraClass}`;
  if (asHtml) {
    // Intentional: we render assistant HTML for clinical formatting.
    // (This is the vulnerability surface from the player's POV — but
    // their own session only renders to themselves. The pharmacist
    // bot is what makes it dangerous.)
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }
  wrap.appendChild(who);
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  scrollDown();
  return bubble;
}

function scrollDown() { chat.scrollTop = chat.scrollHeight; }

async function send(message) {
  addMessage("user", message);
  let active = addMessage("assistant", "establishing channel…", "thinking");

  button.disabled = true;
  input.disabled = true;

  try {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok || !res.body) {
      const fb = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await fb.json();
      active.classList.remove("thinking");
      active.innerHTML = data.response || "(no response)";
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let leftover  = "";
    let buffered  = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      leftover += decoder.decode(value, { stream: true });
      const events = leftover.split(/\n\n/);
      leftover = events.pop() || "";

      for (const ev of events) {
        const line = ev.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        let payload;
        try { payload = JSON.parse(line.slice(6)); } catch { continue; }

        switch (payload.type) {
          case "status":
            active.classList.remove("thinking", "streaming");
            active.classList.add("status");
            active.textContent = payload.data;
            active = addMessage("assistant", "processing…", "thinking");
            buffered = "";
            scrollDown();
            break;
          case "token":
            if (active.classList.contains("thinking")) {
              active.classList.remove("thinking");
              active.classList.add("streaming");
              active.textContent = "";
              buffered = "";
            }
            buffered += payload.data;
            // Show streaming as text first; we'll switch to HTML on final.
            active.textContent = buffered;
            scrollDown();
            break;
          case "final":
            active.classList.remove("thinking", "streaming");
            // Switch to HTML rendering for the final reply.
            active.innerHTML = payload.data;
            scrollDown();
            break;
          case "error":
            active.classList.remove("thinking", "streaming");
            active.classList.add("status");
            active.textContent = "MEDBAY ERROR · " + payload.data;
            scrollDown();
            break;
          case "done": break;
        }
      }
    }
  } catch (err) {
    active.classList.remove("thinking", "streaming");
    active.classList.add("status");
    active.textContent = "LINK FAILURE · " + err.message;
  } finally {
    button.disabled = false;
    input.disabled  = false;
    input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  send(text);
});
