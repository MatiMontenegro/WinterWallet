// Tiny UI helpers — toast notifications, confirm dialogs, copy-to-clipboard,
// address shortening. No third-party dependency: keeps the deploy simple.

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function shortAddress(addr, head = 6, tail = 4) {
  if (!addr) return "";
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard.", "ok");
  } catch {
    toast("Could not copy.", "warn");
  }
}

let toastRoot = null;
function ensureToastRoot() {
  if (toastRoot) return toastRoot;
  toastRoot = document.createElement("div");
  toastRoot.className = "ww-toast-root";
  toastRoot.setAttribute("role", "status");
  toastRoot.setAttribute("aria-live", "polite");
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function toast(message, kind = "info", ms = 4000) {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  el.className = `ww-toast ww-toast-${kind}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, ms);
}

// Modal dialog. Returns a Promise that resolves to true (confirm) / false.
export function confirmDialog({ title, body, confirmText = "Confirm", cancelText = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ww-modal-overlay";
    overlay.innerHTML = `
      <div class="ww-modal" role="dialog" aria-modal="true" aria-labelledby="ww-modal-title">
        <h3 id="ww-modal-title">${escapeHtml(title)}</h3>
        <div class="ww-modal-body"></div>
        <div class="ww-modal-actions">
          <button type="button" class="ww-btn ww-btn-ghost" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="ww-btn ${danger ? "ww-btn-danger" : "ww-btn-primary"}" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    const bodyEl = overlay.querySelector(".ww-modal-body");
    if (typeof body === "string") bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);
    document.body.appendChild(overlay);

    const close = (val) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => close(false));
    overlay.querySelector('[data-act="ok"]').addEventListener("click", () => close(true));
  });
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function setBusy(el, busy = true) {
  if (!el) return;
  if (busy) {
    el.dataset.prevText = el.textContent;
    el.disabled = true;
    el.classList.add("is-busy");
    el.innerHTML = `<span class="ww-spinner" aria-hidden="true"></span> Working…`;
  } else {
    el.disabled = false;
    el.classList.remove("is-busy");
    if (el.dataset.prevText) el.textContent = el.dataset.prevText;
  }
}

export function fmtNumber(n, max = 6) {
  const num = Number(n);
  if (!isFinite(num)) return "0";
  if (num === 0) return "0";
  if (Math.abs(num) < 1e-6) return num.toExponential(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: max });
}
