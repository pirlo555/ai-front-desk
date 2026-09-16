/*
 * Chat widget. Clinics add one line to their website:
 *   <script src="https://YOUR-SERVER/widget.js" data-clinic="brisa" defer></script>
 */
(function () {
  const script = document.currentScript;
  if (!script) return;
  const clinicId = script.dataset.clinic;
  const base = new URL(script.src).origin;
  const storeKey = `dla:${clinicId}`;

  function load() {
    try { return JSON.parse(localStorage.getItem(storeKey)) || null; } catch { return null; }
  }
  function save(state) {
    try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch {}
  }
  function newSession() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  let state = load();
  if (!state || !state.session || Date.now() - (state.startedAt || 0) > 7 * 86400000) {
    state = { session: newSession(), startedAt: Date.now(), messages: [] };
  }

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;";
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
      .launcher { width: 60px; height: 60px; border-radius: 50%; border: 0; cursor: pointer; background: var(--c); color: #fff;
        box-shadow: 0 10px 30px -10px rgba(0,0,0,.45); display: grid; place-items: center; margin-left: auto; }
      .launcher svg { width: 28px; height: 28px; }
      .panel { width: min(370px, calc(100vw - 32px)); height: min(560px, calc(100vh - 110px)); background: #fff; color: #10231F;
        border-radius: 18px; box-shadow: 0 24px 60px -20px rgba(0,0,0,.45); display: flex; flex-direction: column; overflow: hidden; margin-bottom: 12px;
        border: 1px solid #D3E2DE; }
      .panel[hidden] { display: none; }
      header { background: var(--c); color: #fff; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      header b { font-size: 15px; display: block; }
      header small { font-size: 12px; opacity: .85; }
      header button { background: transparent; border: 0; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; padding: 4px; }
      .thread { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #F6FAF9; }
      .msg { max-width: 85%; padding: 9px 12px; border-radius: 16px; font-size: 14.5px; line-height: 1.42; white-space: pre-wrap; overflow-wrap: anywhere; }
      .bot { align-self: flex-start; background: #E7EFED; border-bottom-left-radius: 5px; }
      .me { align-self: flex-end; background: var(--c); color: #fff; border-bottom-right-radius: 5px; }
      .typing { color: #7A8D88; font-style: italic; }
      form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #D3E2DE; background: #fff; }
      input { flex: 1; min-width: 0; border: 1px solid #D3E2DE; border-radius: 999px; padding: 10px 14px; font-size: 14.5px; color: #10231F; background: #F6FAF9; }
      .send { border: 0; border-radius: 999px; background: var(--c); color: #fff; padding: 0 16px; font-weight: 600; cursor: pointer; font-size: 14px; }
      .send:disabled { opacity: .55; cursor: not-allowed; }
      .note { font-size: 11px; color: #7A8D88; text-align: center; padding: 0 10px 8px; background: #fff; }
      button:focus-visible, input:focus-visible { outline: 2px solid #10231F; outline-offset: 2px; }
    </style>
    <div class="panel" hidden role="dialog" aria-label="Chat with the clinic">
      <header><div><b class="name">Chat</b><small>Replies in seconds · English / Español</small></div>
        <button class="close" aria-label="Close chat">×</button></header>
      <div class="thread" aria-live="polite"></div>
      <form><input aria-label="Message" maxlength="1000" placeholder="Type your message… / Escriba su mensaje…" autocomplete="off">
        <button class="send" type="submit">Send</button></form>
      <div class="note">Automated assistant. For emergencies call 911.</div>
    </div>
    <button class="launcher" aria-label="Open chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>
    </button>`;

  const $ = (s) => root.querySelector(s);
  const panel = $(".panel"), thread = $(".thread"), form = $("form"), input = $("input"), sendBtn = $(".send");
  let greeting = "Hi! How can we help? / ¡Hola! ¿En qué le ayudamos?";
  let busy = false;

  function bubble(role, text, extra) {
    const el = document.createElement("div");
    el.className = `msg ${role === "user" ? "me" : "bot"}${extra ? " " + extra : ""}`;
    el.textContent = text;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }
  function render() {
    thread.textContent = "";
    bubble("assistant", greeting);
    state.messages.forEach((m) => bubble(m.role, m.text));
  }

  fetch(`${base}/api/clinics/${encodeURIComponent(clinicId)}/public`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((c) => {
      host.style.setProperty("--c", c.color);
      root.host.style.setProperty("--c", c.color);
      $(".name").textContent = c.name;
      greeting = c.greeting;
      render();
      document.body.appendChild(host);
    })
    .catch(() => console.warn("[chat widget] clinic not available"));

  host.style.setProperty("--c", "#0F6B5C");

  $(".launcher").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { render(); input.focus(); }
  });
  $(".close").addEventListener("click", () => { panel.hidden = true; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; input.value = "";
    state.messages.push({ role: "user", text });
    save(state);
    bubble("user", text);
    const pending = bubble("assistant", "…", "typing");
    try {
      const r = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic: clinicId, session: state.session, message: text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "The chat is not available right now. Call the clinic instead.");
      pending.remove();
      if (data.reply) {
        state.messages.push({ role: "assistant", text: data.reply });
        save(state);
        bubble("assistant", data.reply);
      }
    } catch (err) {
      pending.classList.remove("typing");
      pending.textContent = err.message || "Message not sent. Check your connection and try again.";
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  });
})();
