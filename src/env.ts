// Typed accessors for VITE_* env vars. All values are public (baked into the
// browser bundle); secrets must live in Cloudflare Pages secrets or Supabase
// Edge Function env, never here.

const env = import.meta.env;

function str(name: string, fallback = ""): string {
  const v = env[name as keyof ImportMetaEnv];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}
function num(name: string, fallback: number): number {
  const raw = env[name as keyof ImportMetaEnv];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const ENV = {
  appName: str("VITE_APP_NAME", "WinterWallet"),
  appUrl: str("VITE_APP_URL", typeof window !== "undefined" ? window.location.origin : ""),

  supabaseUrl: str("VITE_SUPABASE_URL"),
  supabaseAnonKey: str("VITE_SUPABASE_ANON_KEY"),
  siweVerifyUrl: str("VITE_SIWE_VERIFY_URL"),

  walletConnectProjectId: str("VITE_WALLETCONNECT_PROJECT_ID", "00000000000000000000000000000000"),

  defaultChainId: num("VITE_DEFAULT_CHAIN_ID", 11155111),

  rpcSepolia: str("VITE_RPC_SEPOLIA"),
  rpcMainnet: str("VITE_RPC_MAINNET"),
  rpcPolygonAmoy: str("VITE_RPC_POLYGON_AMOY"),
  rpcPolygon: str("VITE_RPC_POLYGON"),

  feeBps: num("VITE_FEE_BPS", 30),
  feeRouter: {
    11155111: str("VITE_FEE_ROUTER_SEPOLIA"),
    1: str("VITE_FEE_ROUTER_MAINNET"),
    80002: str("VITE_FEE_ROUTER_POLYGON_AMOY"),
    137: str("VITE_FEE_ROUTER_POLYGON"),
  } as Record<number, string>,
};

export const supabaseConfigured = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
export const siweConfigured = Boolean(ENV.siweVerifyUrl);
