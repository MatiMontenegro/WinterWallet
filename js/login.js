// Wires up the connect / create / import / unlock tabs on login.html.

import {
  connectInjected,
  hasInjected,
  hasLocalWallet,
  createLocalWallet,
  importLocalWallet,
  unlockLocalWallet,
  destroyLocalWallet,
} from "./wallet.js";
import { $, $$, toast, confirmDialog, escapeHtml, setBusy } from "./ui.js";

// ---------------------------------------------------------------- tab switch
const tabs = $$(".ww-tab");
const panels = $$(".ww-tabpanel");
function activateTab(name) {
  tabs.forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", String(active));
  });
  panels.forEach((p) => {
    p.hidden = p.dataset.panel !== name;
  });
}
tabs.forEach((t) => t.addEventListener("click", () => activateTab(t.dataset.tab)));

// If a local wallet exists, surface the Unlock tab and pre-select it.
if (hasLocalWallet()) {
  $("#tab-unlock").hidden = false;
  activateTab("unlock");
}

// -------------------------------------------------------------------- inject
const injectedStatus = $("#injected-status");
if (!hasInjected()) {
  injectedStatus.textContent =
    "No browser wallet detected. Install MetaMask or use the in-browser wallet.";
}
$("#btn-connect-injected").addEventListener("click", async (e) => {
  setBusy(e.currentTarget, true);
  try {
    await connectInjected();
    toast("Connected.", "ok");
    location.href = "index.html";
  } catch (err) {
    toast(err.message ?? "Could not connect.", "warn");
    setBusy(e.currentTarget, false);
  }
});

// -------------------------------------------------------------------- create
$("#form-create").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const password = fd.get("password");
  const confirm = fd.get("confirm");
  if (password !== confirm) {
    toast("Passwords do not match.", "warn");
    return;
  }
  const submit = e.currentTarget.querySelector('button[type="submit"]');
  setBusy(submit, true);
  try {
    const { mnemonic, address } = await createLocalWallet(password);
    const ok = await showMnemonicDialog(mnemonic, address);
    if (!ok) {
      destroyLocalWallet();
      toast("Wallet discarded.", "info");
      setBusy(submit, false);
      return;
    }
    await unlockLocalWallet(password);
    location.href = "index.html";
  } catch (err) {
    toast(err.message ?? "Could not create wallet.", "warn");
    setBusy(submit, false);
  }
});

async function showMnemonicDialog(mnemonic, address) {
  const words = mnemonic.split(/\s+/);
  const body = document.createElement("div");
  body.innerHTML = `
    <p>This 12-word phrase is the <strong>only way</strong> to restore wallet
    <code>${escapeHtml(address)}</code> on another device. Write it down on
    paper. Do not screenshot. Do not paste it into a chat. Anyone who has
    these words controls these funds.</p>
    <ol class="ww-mnemonic">${words.map((w, i) => `<li><span>${i + 1}.</span> ${escapeHtml(w)}</li>`).join("")}</ol>
    <label class="ww-checkbox">
      <input type="checkbox" id="ww-ack-mnemonic" />
      I have saved my recovery phrase securely.
    </label>
  `;
  // Disable the OK button until the user acknowledges. Wired after mount via rAF.
  requestAnimationFrame(() => {
    const okBtn = document.querySelector('.ww-modal [data-act="ok"]');
    const cb = document.getElementById("ww-ack-mnemonic");
    if (!okBtn || !cb) return;
    okBtn.disabled = true;
    cb.addEventListener("change", () => { okBtn.disabled = !cb.checked; });
  });
  return confirmDialog({
    title: "Save your recovery phrase",
    body,
    confirmText: "I have saved it",
    cancelText: "Discard wallet",
  });
}

// -------------------------------------------------------------------- import
$("#form-import").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const submit = e.currentTarget.querySelector('button[type="submit"]');
  setBusy(submit, true);
  try {
    await importLocalWallet(fd.get("mnemonic"), fd.get("password"));
    await unlockLocalWallet(fd.get("password"));
    toast("Wallet imported.", "ok");
    location.href = "index.html";
  } catch (err) {
    toast(err.message ?? "Could not import wallet.", "warn");
    setBusy(submit, false);
  }
});

// -------------------------------------------------------------------- unlock
$("#form-unlock").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const submit = e.currentTarget.querySelector('button[type="submit"]');
  setBusy(submit, true);
  try {
    await unlockLocalWallet(fd.get("password"));
    location.href = "index.html";
  } catch (err) {
    toast(err.message ?? "Unlock failed.", "warn");
    setBusy(submit, false);
  }
});

$("#btn-forget").addEventListener("click", async () => {
  const ok = await confirmDialog({
    title: "Remove the wallet from this device?",
    body: `
      <p>This deletes the encrypted wallet stored on this browser. The
      blockchain itself is unaffected — you can restore the same addresses
      anywhere with the recovery phrase.</p>
      <p><strong>If you do not have your recovery phrase saved, do not
      proceed.</strong> Your funds will be permanently inaccessible from this
      device.</p>
    `,
    confirmText: "Remove wallet",
    danger: true,
  });
  if (!ok) return;
  destroyLocalWallet();
  toast("Local wallet removed.", "info");
  location.reload();
});
