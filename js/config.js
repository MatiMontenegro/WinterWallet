// Defaults applied when `window.WW_CONFIG` is missing fields.
// `window.WW_CONFIG` is set by the optional, gitignored `/config.js` script
// loaded by index.html and login.html.
const DEFAULTS = {
  rpc: {
    11155111: "https://ethereum-sepolia-rpc.publicnode.com",
    1: "https://ethereum-rpc.publicnode.com",
    80002: "https://polygon-amoy-bor-rpc.publicnode.com",
    137: "https://polygon-bor-rpc.publicnode.com",
  },
  defaultChainId: 11155111,
  supabase: { url: null, anonKey: null, siweEndpoint: null },
  walletConnectProjectId: null,
};

export function getConfig() {
  const user = (typeof window !== "undefined" && window.WW_CONFIG) || {};
  return {
    ...DEFAULTS,
    ...user,
    rpc: { ...DEFAULTS.rpc, ...(user.rpc || {}) },
    supabase: { ...DEFAULTS.supabase, ...(user.supabase || {}) },
  };
}

export function isSupabaseConfigured() {
  const s = getConfig().supabase;
  return Boolean(s?.url && s?.anonKey);
}
