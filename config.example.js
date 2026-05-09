// Copy this file to `config.js` (which is gitignored) and fill in your values.
// `config.js` is loaded by index.html / login.html before any module scripts.
//
// All fields are optional:
//   - Without RPC URLs, the wallet falls back to public RPCs (rate-limited).
//   - Without Supabase, transaction history is stored only in IndexedDB.
//   - Without WalletConnect, only browser-injected wallets and the in-browser
//     wallet are available.
//
// NEVER put a private key, mnemonic, or service-role key here. This file is
// shipped to the browser. Only public values belong here.
window.WW_CONFIG = {
  rpc: {
    // Sepolia (Ethereum testnet) — get a free key at https://infura.io or https://alchemy.com
    11155111: "https://ethereum-sepolia-rpc.publicnode.com",
    // Ethereum mainnet
    1: "https://ethereum-rpc.publicnode.com",
    // Polygon Amoy testnet
    80002: "https://polygon-amoy-bor-rpc.publicnode.com",
    // Polygon mainnet
    137: "https://polygon-bor-rpc.publicnode.com",
  },

  // Default chain to load on first visit. 11155111 = Sepolia testnet (recommended).
  defaultChainId: 11155111,

  // Optional Supabase project for persisted transaction history with RLS.
  // Leave as null to disable.
  supabase: {
    url: null,           // e.g. "https://xxxxxxxx.supabase.co"
    anonKey: null,       // anon (public) key — RLS protects all data
    siweEndpoint: null,  // e.g. "https://xxxxxxxx.supabase.co/functions/v1/siwe-verify"
  },

  // Optional WalletConnect v2 project id (https://cloud.walletconnect.com).
  walletConnectProjectId: null,
};
