import { sepolia, mainnet, polygon, polygonAmoy, type Chain } from "wagmi/chains";
import { ENV } from "../env";

export interface ChainMeta {
  chain: Chain;
  isTestnet: boolean;
  shortName: string;
  faucets?: string[];
  /** Per-chain ERC-20 list (limited for now to USDC). */
  tokens: Record<string, { address: `0x${string}`; decimals: number }>;
}

export const CHAINS: Record<number, ChainMeta> = {
  [sepolia.id]: {
    chain: sepolia,
    isTestnet: true,
    shortName: "Sepolia testnet",
    faucets: [
      "https://www.alchemy.com/faucets/ethereum-sepolia",
      "https://sepolia-faucet.pk910.de",
    ],
    tokens: {
      USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
    },
  },
  [mainnet.id]: {
    chain: mainnet,
    isTestnet: false,
    shortName: "Ethereum mainnet",
    tokens: {
      USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    },
  },
  [polygonAmoy.id]: {
    chain: polygonAmoy,
    isTestnet: true,
    shortName: "Polygon Amoy testnet",
    faucets: ["https://faucet.polygon.technology"],
    tokens: {
      USDC: { address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", decimals: 6 },
    },
  },
  [polygon.id]: {
    chain: polygon,
    isTestnet: false,
    shortName: "Polygon mainnet",
    tokens: {
      USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    },
  },
};

export function getChainMeta(id: number): ChainMeta {
  const m = CHAINS[id];
  if (!m) throw new Error(`Unknown chain id: ${id}`);
  return m;
}

export function listChains(includeMainnet: boolean): ChainMeta[] {
  return Object.values(CHAINS).filter((c) => includeMainnet || c.isTestnet);
}

export function explorerTxUrl(chainId: number, hash: string): string {
  const c = getChainMeta(chainId).chain;
  const base = c.blockExplorers?.default?.url ?? "";
  return `${base}/tx/${hash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  const c = getChainMeta(chainId).chain;
  const base = c.blockExplorers?.default?.url ?? "";
  return `${base}/address/${address}`;
}

/** Fee router contract address per chain (empty string when not deployed). */
export function feeRouterFor(chainId: number): `0x${string}` | undefined {
  const a = ENV.feeRouter[chainId];
  return a && a.startsWith("0x") && a.length === 42 ? (a as `0x${string}`) : undefined;
}
