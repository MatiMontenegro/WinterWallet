// Main wallet dashboard wiring.

import { ethers } from "https://esm.sh/ethers@6.13.5";
import {
  getMode,
  getCachedAddress,
  isUnlocked,
  connectInjected,
  hasLocalWallet,
  hasInjected,
  logout,
  switchChain,
  getNativeBalance,
  estimateNative,
  sendNative,
  onWalletEvent,
} from "./wallet.js";
import { getChain, getActiveChainId, listChains } from "./network.js";
import { getTokenBalance, sendToken } from "./erc20.js";
import { getPrices } from "./prices.js";
import { isReady as supabaseReady, recordTransaction, listTransactions, siweLogin, siweLogout } from "./supabase.js";
import { $, toast, confirmDialog, copy, escapeHtml, setBusy, fmtNumber, shortAddress } from "./ui.js";

// ---------------------------------------------------------------- bootstrap
//
// Three valid entry states:
//   - Injected wallet previously connected → re-attach silently.
//   - Local wallet exists → bounce to login to unlock.
//   - Nothing → bounce to login.

(async function bootstrap() {
  const mode = getMode();
  if (mode === "injected" && hasInjected()) {
    try {
      await connectInjected();
    } catch {
      location.href = "login.html";
      return;
    }
  } else if (mode === "local" && hasLocalWallet() && !isUnlocked()) {
    location.href = "login.html";
    return;
  } else if (!isUnlocked()) {
    location.href = "login.html";
    return;
  }
  await renderAll();
})();

// ---------------------------------------------------------------- top bar
const networkSelect = $("#network-select");
const showMainnet = $("#show-mainnet");
showMainnet.checked = localStorage.getItem("ww:showMainnet") === "1";
showMainnet.addEventListener("change", () => {
  localStorage.setItem("ww:showMainnet", showMainnet.checked ? "1" : "0");
  populateNetworks();
});

function populateNetworks() {
  const includeMainnet = showMainnet.checked;
  const chains = listChains({ includeMainnet });
  const active = getActiveChainId();
  networkSelect.innerHTML = chains
    .map(
      (c) => `<option value="${c.chainId}" ${c.chainId === active ? "selected" : ""}>
        ${escapeHtml(c.name)} ${c.isTestnet ? "(testnet)" : ""}
      </option>`,
    )
    .join("");
}

networkSelect.addEventListener("change", async (e) => {
  const chainId = Number(e.target.value);
  const chain = getChain(chainId);
  if (!chain.isTestnet) {
    const ok = await confirmDialog({
      title: `Switch to ${chain.name} mainnet?`,
      body: `<p>Mainnet transactions move <strong>real cryptocurrency</strong> and cost
        <strong>real gas fees</strong>. They are irreversible. Make sure you understand
        what you are signing before approving any transaction.</p>`,
      confirmText: "Switch to mainnet",
      cancelText: "Stay on testnet",
      danger: true,
    });
    if (!ok) {
      populateNetworks();
      return;
    }
  }
  try {
    await switchChain(chainId);
  } catch (err) {
    toast(err.message ?? "Could not switch network.", "warn");
    populateNetworks();
  }
});

$("#account-chip").addEventListener("click", () => copy(getCachedAddress()));
$("#copy-address").addEventListener("click", () => copy(getCachedAddress()));

$("#logout-btn").addEventListener("click", async () => {
  if (supabaseReady()) await siweLogout().catch(() => {});
  logout();
  location.href = "login.html";
});

$("#refresh-btn").addEventListener("click", () => renderAll());

// React to in-wallet account/chain changes.
onWalletEvent(async (evt) => {
  if (evt.type === "logout") {
    location.href = "login.html";
    return;
  }
  if (evt.type === "chainChanged" || evt.type === "accountChanged") {
    populateNetworks();
    await renderAll();
  }
});

// ---------------------------------------------------------------- main render
async function renderAll() {
  const addr = getCachedAddress();
  const chainId = getActiveChainId();
  const chain = getChain(chainId);
  populateNetworks();

  $("#account-address").textContent = shortAddress(addr);
  $("#receive-address").textContent = addr;
  $("#explorer-link").href = `${chain.explorer}/address/${addr}`;
  $("#native-symbol").textContent = chain.nativeSymbol;

  // Banners
  const isTestnet = chain.isTestnet;
  $("#testnet-banner").hidden = !isTestnet;
  $("#mainnet-banner").hidden = isTestnet;
  if (isTestnet && chain.faucets?.[0]) {
    $("#faucet-link").href = chain.faucets[0];
    $("#faucet-link").textContent = `Get test ${chain.nativeSymbol} ↗`;
  }

  await Promise.allSettled([renderBalances(), renderPrices(), renderHistory()]);
}

async function renderBalances() {
  const addr = getCachedAddress();
  const chainId = getActiveChainId();
  const chain = getChain(chainId);
  try {
    const wei = await getNativeBalance(addr);
    $("#native-amount").textContent = fmtNumber(ethers.formatEther(wei), 6);
  } catch (e) {
    $("#native-amount").textContent = "—";
    console.warn("native balance failed", e);
  }

  const usdc = chain.tokens?.USDC;
  if (usdc) {
    try {
      const { formatted } = await getTokenBalance(usdc.address, addr);
      $("#usdc-amount").textContent = fmtNumber(formatted, 2);
    } catch (e) {
      $("#usdc-amount").textContent = "—";
    }
  } else {
    $("#usdc-amount").textContent = "n/a";
  }
}

async function renderPrices() {
  const chain = getChain(getActiveChainId());
  const symbols = [chain.nativeSymbol, "USDC", "BTC"];
  const prices = await getPrices(symbols, "usd");
  $("#prices-list").innerHTML = symbols
    .map(
      (s) => `<li><span class="ww-mono">${escapeHtml(s)}</span><span>${prices[s] != null ? "$" + fmtNumber(prices[s], 2) : "—"}</span></li>`,
    )
    .join("");

  // Fiat lines under the balance.
  const native = Number($("#native-amount").textContent.replace(/,/g, ""));
  const usdc = Number($("#usdc-amount").textContent.replace(/,/g, ""));
  const np = prices[chain.nativeSymbol];
  $("#native-fiat").textContent = np && isFinite(native) ? `≈ $${fmtNumber(native * np, 2)}` : "—";
  const up = prices.USDC;
  $("#usdc-fiat").textContent = up && isFinite(usdc) ? `≈ $${fmtNumber(usdc * up, 2)}` : "—";
}

// ----------------------------------------------------------------- history
async function renderHistory() {
  const list = $("#history-list");
  const src = $("#history-source");
  let rows = [];

  if (supabaseReady()) {
    try {
      rows = await listTransactions({ chainId: getActiveChainId(), limit: 25 });
      src.textContent = `Supabase (RLS-protected) · ${rows.length} rows`;
    } catch (e) {
      src.textContent = `Supabase error: ${e.message}`;
    }
  } else {
    src.textContent = "Supabase not configured — showing in-memory only";
    rows = [];
  }

  if (rows.length === 0) {
    list.innerHTML = `<p class="ww-muted">No transactions yet. Send something to see it here.</p>`;
    return;
  }
  const chain = getChain(getActiveChainId());
  list.innerHTML = rows
    .map((r) => {
      const dir = r.direction === "out" ? "↑" : "↓";
      const cls = r.direction === "out" ? "out" : "in";
      const status = r.status ?? "pending";
      return `
        <div class="ww-tx ww-tx-${cls}">
          <div class="ww-tx-arrow">${dir}</div>
          <div class="ww-tx-main">
            <div class="ww-tx-amount"><span class="ww-mono">${escapeHtml(r.amount)}</span> ${escapeHtml(r.asset_symbol)}</div>
            <div class="ww-tx-peer ww-mono">${shortAddress(r.counterparty)}</div>
          </div>
          <div class="ww-tx-meta">
            <span class="ww-tx-status ww-tx-status-${status}">${escapeHtml(status)}</span>
            <a class="ww-tiny" href="${chain.explorer}/tx/${r.tx_hash}" target="_blank" rel="noopener">view ↗</a>
          </div>
        </div>`;
    })
    .join("");
}

// ----------------------------------------------------------------- send form
const sendForm = $("#send-form");
const sendAsset = $("#send-asset");
const gasLine = $("#gas-estimate");

let gasTimer = null;
function scheduleGasEstimate() {
  clearTimeout(gasTimer);
  gasTimer = setTimeout(updateGasEstimate, 400);
}
sendForm.addEventListener("input", scheduleGasEstimate);

async function updateGasEstimate() {
  const fd = new FormData(sendForm);
  const to = fd.get("to");
  const amount = fd.get("amount");
  const asset = fd.get("asset");
  if (!to || !amount || !ethers.isAddress(to) || Number(amount) <= 0) {
    gasLine.textContent = "Estimated network fee: —";
    return;
  }
  try {
    if (asset === "native") {
      const est = await estimateNative(to, amount);
      const chain = getChain(getActiveChainId());
      gasLine.textContent = `Estimated network fee: ~${fmtNumber(est.totalGasCostEth, 6)} ${chain.nativeSymbol}`;
    } else {
      // ERC-20 estimate is approximate (we don't simulate the call here).
      gasLine.textContent = `Estimated network fee: depends on token (~$0.01–$2 typical)`;
    }
  } catch (e) {
    gasLine.textContent = `Estimate failed: ${e.shortMessage ?? e.message}`;
  }
}

$("#send-max").addEventListener("click", async () => {
  const asset = sendAsset.value;
  const amountInput = sendForm.querySelector('input[name="amount"]');
  if (asset === "native") {
    try {
      const wei = await getNativeBalance();
      // Reserve a tiny buffer for gas. User can still edit.
      const buffer = ethers.parseEther("0.0005");
      const usable = wei > buffer ? wei - buffer : 0n;
      amountInput.value = ethers.formatEther(usable);
    } catch {
      toast("Could not read balance.", "warn");
    }
  } else {
    const usdc = getChain(getActiveChainId()).tokens?.USDC;
    if (!usdc) return;
    const { formatted } = await getTokenBalance(usdc.address);
    amountInput.value = formatted;
  }
  scheduleGasEstimate();
});

sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(sendForm);
  const to = fd.get("to");
  const amount = fd.get("amount");
  const asset = fd.get("asset");
  const chain = getChain(getActiveChainId());

  if (!ethers.isAddress(to)) return toast("Invalid recipient address.", "warn");
  if (Number(amount) <= 0) return toast("Amount must be positive.", "warn");

  const ok = await confirmDialog({
    title: "Confirm transaction",
    body: `
      <dl class="ww-confirm">
        <dt>Network</dt><dd>${escapeHtml(chain.shortName)}${chain.isTestnet ? "" : " — <strong>real money</strong>"}</dd>
        <dt>Asset</dt><dd>${escapeHtml(asset === "native" ? chain.nativeSymbol : asset)}</dd>
        <dt>Amount</dt><dd class="ww-mono">${escapeHtml(amount)}</dd>
        <dt>To</dt><dd class="ww-mono">${escapeHtml(to)}</dd>
      </dl>
      <p class="ww-muted">Once broadcast, this transaction cannot be reversed.</p>
    `,
    confirmText: chain.isTestnet ? "Send" : "Send (mainnet)",
    danger: !chain.isTestnet,
  });
  if (!ok) return;

  const submitBtn = sendForm.querySelector('button[type="submit"]');
  setBusy(submitBtn, true);

  try {
    let tx;
    let symbol;
    if (asset === "native") {
      tx = await sendNative(to, amount);
      symbol = chain.nativeSymbol;
    } else {
      const token = chain.tokens?.[asset];
      if (!token) throw new Error(`${asset} is not configured on ${chain.name}.`);
      tx = await sendToken(token.address, to, amount, token.decimals);
      symbol = asset;
    }

    toast(`Broadcast: ${shortAddress(tx.hash, 10, 6)}`, "ok", 6000);

    // Persist the pending row immediately. RLS ensures the wallet only writes
    // its own row.
    if (supabaseReady()) {
      try {
        await recordTransaction({
          tx_hash: tx.hash,
          chain_id: chain.chainId,
          direction: "out",
          counterparty: to,
          amount: String(amount),
          asset_symbol: symbol,
          status: "pending",
          wallet_address: getCachedAddress().toLowerCase(),
        });
        await renderHistory();
      } catch (e) {
        console.warn("persist tx failed", e);
      }
    }

    sendForm.reset();
    gasLine.textContent = "Estimated network fee: —";

    // Wait for confirmation in the background and update.
    tx.wait().then(async (receipt) => {
      const ok = receipt.status === 1;
      toast(ok ? "Confirmed ✓" : "Reverted ✗", ok ? "ok" : "warn");
      if (supabaseReady()) {
        const client = (await import("./supabase.js")).getClient();
        await client.from("transactions").update({
          status: ok ? "confirmed" : "reverted",
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed.toString(),
        }).eq("tx_hash", tx.hash);
        await renderHistory();
      }
      await renderBalances();
    }).catch((err) => {
      toast(`Tx failed: ${err.shortMessage ?? err.message}`, "warn");
    });
  } catch (err) {
    toast(err.shortMessage ?? err.message ?? "Transaction failed.", "warn");
  } finally {
    setBusy(submitBtn, false);
  }
});

// -------------------------------------------------------- optional SIWE auth
//
// If Supabase is configured, prompt for SIWE the first time on this device.
// The signed message proves wallet ownership; the Edge Function exchanges it
// for a Supabase session that carries `wallet_address` as a JWT claim, which
// RLS policies then key off.

(async function maybeSiwe() {
  if (!supabaseReady()) return;
  const { isSignedIn } = await import("./supabase.js");
  if (await isSignedIn()) return;
  const ok = await confirmDialog({
    title: "Sign in for transaction history",
    body: `<p>This wallet has Supabase configured. Sign a one-line message to
      enable encrypted, RLS-protected transaction history. <strong>No fee. No
      transaction.</strong> Just a signature proving you own this address.</p>`,
    confirmText: "Sign message",
    cancelText: "Skip",
  });
  if (!ok) return;
  try {
    await siweLogin({ address: getCachedAddress(), chainId: getActiveChainId() });
    toast("Signed in.", "ok");
    await renderHistory();
  } catch (e) {
    toast(`SIWE failed: ${e.message}`, "warn");
  }
})();
