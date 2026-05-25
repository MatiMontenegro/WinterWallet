import { http } from "wagmi";
import { sepolia, mainnet, polygon, polygonAmoy } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ENV } from "../env";

/**
 * RainbowKit wraps wagmi with sane defaults: injected, MetaMask, Rabby,
 * Coinbase, WalletConnect, and Safe out of the box. We just configure RPCs.
 */
export const wagmiConfig = getDefaultConfig({
  appName: ENV.appName,
  appDescription: "Real, non-custodial EVM wallet — installable on iPhone.",
  appUrl: ENV.appUrl,
  projectId: ENV.walletConnectProjectId,
  chains: [sepolia, polygonAmoy, mainnet, polygon],
  transports: {
    [sepolia.id]: http(ENV.rpcSepolia || undefined),
    [mainnet.id]: http(ENV.rpcMainnet || undefined),
    [polygonAmoy.id]: http(ENV.rpcPolygonAmoy || undefined),
    [polygon.id]: http(ENV.rpcPolygon || undefined),
  },
  ssr: false,
});
