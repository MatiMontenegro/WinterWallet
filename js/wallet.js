// Wallet abstraction with two backends:
//   1. Injected EIP-1193 provider (MetaMask, Rabby, Brave, etc.)
//   2. In-browser ethers.HDNodeWallet generated from BIP-39 mnemonic and
//      encrypted at rest with PBKDF2 + AES-GCM.
//
// Both expose the same Signer-shaped API so the rest of the app does not care
// which backend is active.

import { ethers } from "https://esm.sh/ethers@6.13.5";
import { encryptString, decryptString } from "./crypto.js";
import { getActiveChainId, getChain, rpcUrlFor, setActiveChainId } from "./network.js";

const STORAGE = {
  mode: "ww:mode",                // "injected" | "local"
  encrypted: "ww:wallet:v1",      // encrypted JSON envelope of the mnemonic
  address: "ww:address",          // cached active address (display only)
};

let _signer = null;
let _provider = null;
let _mode = null;

const listeners = new Set();
function emit(evt) {
  for (const fn of listeners) {
    try { fn(evt); } catch (e) { console.error(e); }
  }
}
export function onWalletEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------- in-browser
//
// We persist the BIP-39 mnemonic (encrypted) so the user can restore the same
// addresses on every visit. The decrypted Wallet only lives in memory.

export function hasLocalWallet() {
  return Boolean(localStorage.getItem(STORAGE.encrypted));
}

export async function createLocalWallet(password) {
  const wallet = ethers.Wallet.createRandom();
  const envelope = await encryptString(wallet.mnemonic.phrase, password);
  localStorage.setItem(STORAGE.encrypted, envelope);
  localStorage.setItem(STORAGE.address, wallet.address);
  return { mnemonic: wallet.mnemonic.phrase, address: wallet.address };
}

export async function importLocalWallet(mnemonic, password) {
  const phrase = mnemonic.trim().split(/\s+/).join(" ");
  const wallet = ethers.Wallet.fromPhrase(phrase);
  const envelope = await encryptString(wallet.mnemonic.phrase, password);
  localStorage.setItem(STORAGE.encrypted, envelope);
  localStorage.setItem(STORAGE.address, wallet.address);
  return { address: wallet.address };
}

export async function unlockLocalWallet(password) {
  const envelope = localStorage.getItem(STORAGE.encrypted);
  if (!envelope) throw new Error("No local wallet found.");
  const phrase = await decryptString(envelope, password);
  const chainId = getActiveChainId();
  const provider = new ethers.JsonRpcProvider(rpcUrlFor(chainId), chainId);
  const wallet = ethers.Wallet.fromPhrase(phrase, provider);
  _signer = wallet;
  _provider = provider;
  _mode = "local";
  localStorage.setItem(STORAGE.mode, "local");
  localStorage.setItem(STORAGE.address, wallet.address);
  emit({ type: "unlocked", address: wallet.address, mode: "local", chainId });
  return wallet.address;
}

export async function exportMnemonic(password) {
  const envelope = localStorage.getItem(STORAGE.encrypted);
  if (!envelope) throw new Error("No local wallet found.");
  return decryptString(envelope, password);
}

export function destroyLocalWallet() {
  localStorage.removeItem(STORAGE.encrypted);
  localStorage.removeItem(STORAGE.address);
  if (_mode === "local") logout();
}

// ------------------------------------------------------------------ injected

function getInjected() {
  return typeof window !== "undefined" ? window.ethereum : null;
}

export function hasInjected() {
  return Boolean(getInjected());
}

export async function connectInjected() {
  const eth = getInjected();
  if (!eth) throw new Error("No browser wallet detected. Install MetaMask or use the in-browser wallet.");
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned by the wallet.");
  const provider = new ethers.BrowserProvider(eth);
  const signer = await provider.getSigner();
  _signer = signer;
  _provider = provider;
  _mode = "injected";
  localStorage.setItem(STORAGE.mode, "injected");
  localStorage.setItem(STORAGE.address, accounts[0]);

  // Sync chainId to active chain.
  const net = await provider.getNetwork();
  setActiveChainId(Number(net.chainId));

  // Wire change listeners (only once).
  if (!eth.__wwHooked) {
    eth.__wwHooked = true;
    eth.on?.("accountsChanged", (accs) => {
      if (!accs || accs.length === 0) {
        logout();
      } else {
        localStorage.setItem(STORAGE.address, accs[0]);
        emit({ type: "accountChanged", address: accs[0] });
      }
    });
    eth.on?.("chainChanged", (hex) => {
      const id = parseInt(hex, 16);
      try { setActiveChainId(id); } catch { /* unknown chain */ }
      emit({ type: "chainChanged", chainId: id });
    });
  }

  emit({ type: "unlocked", address: accounts[0], mode: "injected", chainId: Number(net.chainId) });
  return accounts[0];
}

// ----------------------------------------------------------------- switching

export async function switchChain(chainId) {
  const chain = getChain(chainId);
  if (_mode === "injected") {
    const eth = getInjected();
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.hex }],
      });
    } catch (err) {
      // 4902 = chain not added to the wallet yet.
      if (err.code === 4902 || err?.data?.originalError?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chain.hex,
            chainName: chain.shortName,
            nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: chain.nativeDecimals },
            rpcUrls: [rpcUrlFor(chainId)],
            blockExplorerUrls: [chain.explorer],
          }],
        });
      } else {
        throw err;
      }
    }
    // Re-bind signer/provider on the new chain.
    const provider = new ethers.BrowserProvider(eth);
    _provider = provider;
    _signer = await provider.getSigner();
  } else if (_mode === "local") {
    const provider = new ethers.JsonRpcProvider(rpcUrlFor(chainId), chainId);
    _provider = provider;
    _signer = _signer.connect(provider);
  }
  setActiveChainId(chainId);
  emit({ type: "chainChanged", chainId });
}

// --------------------------------------------------------------- accessors

export function getSigner() {
  if (!_signer) throw new Error("Wallet is locked. Connect or unlock first.");
  return _signer;
}

export function getProvider() {
  if (_provider) return _provider;
  // Read-only fallback so the UI can show prices/etc. before unlock.
  const chainId = getActiveChainId();
  return new ethers.JsonRpcProvider(rpcUrlFor(chainId), chainId);
}

export function getMode() {
  return _mode ?? localStorage.getItem(STORAGE.mode);
}

export function getCachedAddress() {
  return localStorage.getItem(STORAGE.address);
}

export function isUnlocked() {
  return _signer !== null;
}

// ------------------------------------------------------------------ logout

export function logout() {
  _signer = null;
  _provider = null;
  _mode = null;
  localStorage.removeItem(STORAGE.mode);
  localStorage.removeItem(STORAGE.address);
  emit({ type: "logout" });
}

// ----------------------------------------------------------- transaction api

export async function sendNative(to, amountEth) {
  const signer = getSigner();
  if (!ethers.isAddress(to)) throw new Error("Invalid recipient address.");
  const value = ethers.parseEther(String(amountEth));
  const tx = await signer.sendTransaction({ to, value });
  return tx;
}

export async function estimateNative(to, amountEth) {
  const signer = getSigner();
  const provider = getProvider();
  const value = ethers.parseEther(String(amountEth));
  const gasLimit = await provider.estimateGas({
    from: await signer.getAddress(),
    to,
    value,
  });
  const fee = await provider.getFeeData();
  const maxFeePerGas = fee.maxFeePerGas ?? fee.gasPrice;
  const totalGasCost = gasLimit * maxFeePerGas;
  return {
    gasLimit,
    maxFeePerGas,
    totalGasCostWei: totalGasCost,
    totalGasCostEth: ethers.formatEther(totalGasCost),
  };
}

export async function getNativeBalance(address) {
  const provider = getProvider();
  const wei = await provider.getBalance(address ?? getCachedAddress());
  return wei;
}

// SIWE message signing — used by Supabase auth flow.
export async function signMessage(message) {
  return getSigner().signMessage(message);
}
