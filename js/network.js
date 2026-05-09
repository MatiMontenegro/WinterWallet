// Chain registry. Add new EVM chains here.
//
// `isTestnet` gates "real money" warnings in the UI. Mainnets default to OFF
// in the network picker until the user explicitly opts in.

import { getConfig } from "./config.js";

export const CHAINS = {
  11155111: {
    chainId: 11155111,
    hex: "0xaa36a7",
    name: "Sepolia",
    shortName: "Sepolia testnet",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorer: "https://sepolia.etherscan.io",
    isTestnet: true,
    faucets: [
      "https://www.alchemy.com/faucets/ethereum-sepolia",
      "https://sepolia-faucet.pk910.de",
    ],
    tokens: {
      // Circle's official testnet USDC on Sepolia
      USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
    },
  },
  1: {
    chainId: 1,
    hex: "0x1",
    name: "Ethereum",
    shortName: "Ethereum mainnet",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorer: "https://etherscan.io",
    isTestnet: false,
    tokens: {
      USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    },
  },
  80002: {
    chainId: 80002,
    hex: "0x13882",
    name: "Polygon Amoy",
    shortName: "Polygon Amoy testnet",
    nativeSymbol: "MATIC",
    nativeDecimals: 18,
    explorer: "https://amoy.polygonscan.com",
    isTestnet: true,
    faucets: ["https://faucet.polygon.technology"],
    tokens: {
      USDC: { address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", decimals: 6 },
    },
  },
  137: {
    chainId: 137,
    hex: "0x89",
    name: "Polygon",
    shortName: "Polygon mainnet",
    nativeSymbol: "MATIC",
    nativeDecimals: 18,
    explorer: "https://polygonscan.com",
    isTestnet: false,
    tokens: {
      USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    },
  },
};

export function getChain(chainId) {
  const id = Number(chainId);
  const chain = CHAINS[id];
  if (!chain) throw new Error(`Unknown chain id: ${chainId}`);
  return chain;
}

export function listChains({ includeMainnet = false } = {}) {
  return Object.values(CHAINS).filter((c) => includeMainnet || c.isTestnet);
}

export function rpcUrlFor(chainId) {
  const cfg = getConfig();
  const fromConfig = cfg.rpc?.[Number(chainId)];
  if (fromConfig) return fromConfig;
  // Fallback to a built-in public endpoint.
  return getChain(chainId).publicRpc ?? CHAINS[chainId]?.publicRpcFallback ?? null;
}

// Default chain selection: respect saved preference, otherwise config default.
const STORAGE_KEY = "ww:chainId";

export function getActiveChainId() {
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  if (saved && CHAINS[saved]) return saved;
  return getConfig().defaultChainId ?? 11155111;
}

export function setActiveChainId(chainId) {
  if (!CHAINS[Number(chainId)]) throw new Error(`Unknown chain id: ${chainId}`);
  localStorage.setItem(STORAGE_KEY, String(chainId));
}
