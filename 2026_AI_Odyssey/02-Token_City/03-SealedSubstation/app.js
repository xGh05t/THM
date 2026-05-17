const $ = (s) => document.querySelector(s);

const chatlog = $("#chatlog");
const chatform = $("#chatform");
const chatinput = $("#chatinput");
const modelSel = $("#model");

function addMsg(who, text, cls = "msg-sys") {
  const wrap = document.createElement("div");
  wrap.className = `msg ${cls}`;
  const w = document.createElement("div");
  w.className = "who";
  w.textContent = who;
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  wrap.appendChild(w);
  wrap.appendChild(b);
  chatlog.appendChild(wrap);
  chatlog.scrollTop = chatlog.scrollHeight;
  return b;
}

function addTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-sys";
  const w = document.createElement("div");
  w.className = "who";
  w.textContent = "neural-core";
  const b = document.createElement("div");
  b.className = "bubble";
  b.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  wrap.appendChild(w);
  wrap.appendChild(b);
  chatlog.appendChild(wrap);
  chatlog.scrollTop = chatlog.scrollHeight;
  return wrap;
}

chatform.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatinput.value.trim();
  if (!text) return;
  const model = modelSel.value;

  addMsg("operator", text, "msg-user");
  chatinput.value = "";
  const submitBtn = chatform.querySelector("button");
  submitBtn.disabled = true;

  const typing = addTyping();
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, message: text }),
    });
    const data = await r.json();
    typing.remove();
    if (!r.ok) {
      addMsg("system::error", data.error || "transmission failure", "msg-err");
    } else {
      addMsg(data.model || "neural-core", data.reply || "(silence)", "msg-sys");
    }
  } catch (err) {
    typing.remove();
    addMsg("system::error", String(err), "msg-err");
  } finally {
    submitBtn.disabled = false;
    chatinput.focus();
  }
});

// ---- Telemetry relay (SSRF-prone by design) ----
const telemform = $("#telemform");
const telemurl = $("#telemurl");
const telemout = $("#telemout");

telemform.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = telemurl.value.trim();
  if (!url) return;
  telemout.textContent = "// relaying " + url + " ...";
  const btn = telemform.querySelector("button");
  btn.disabled = true;
  try {
    const r = await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await r.json();
    if (!r.ok) {
      telemout.textContent = "// relay error: " + (data.error || r.status);
    } else {
      telemout.textContent =
        `// status: ${data.status}\n// content-type: ${data.content_type}\n// resolved: ${data.url}\n` +
        `// ----- BEGIN PAYLOAD -----\n${data.body}\n// ----- END PAYLOAD -----`;
    }
  } catch (err) {
    telemout.textContent = "// transport failure: " + err;
  } finally {
    btn.disabled = false;
  }
});
