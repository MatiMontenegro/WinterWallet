import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TopBar } from "../components/TopBar";
import { BalanceCard } from "../components/BalanceCard";
import { SendCard } from "../components/SendCard";
import { HistoryCard } from "../components/HistoryCard";
import { InstallPrompt } from "../components/InstallPrompt";
import { useAuth } from "../hooks/useAuth";
import { Logo } from "../components/AuthShell";

export default function DashboardRoute() {
  const { isConnected } = useAccount();
  const { user, enabled: authEnabled } = useAuth();

  return (
    <>
      <TopBar />
      <main
        className="mx-auto max-w-5xl px-4 py-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem)" }}
      >
        {authEnabled && user && (
          <p className="text-text-dim text-sm mb-4">
            Welcome back, <span className="text-text font-medium">{user.user_metadata?.display_name ?? user.email}</span>.
          </p>
        )}

        {!isConnected ? (
          <ConnectGate />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2"><BalanceCard /></div>
            <SendCard />
            <HistoryCard />
          </div>
        )}
      </main>
      <InstallPrompt />
    </>
  );
}

function ConnectGate() {
  return (
    <div className="card-glass p-10 flex flex-col items-center text-center gap-5 animate-fade-up">
      <Logo />
      <div>
        <h2 className="text-xl font-bold">Connect a wallet to get started</h2>
        <p className="text-text-dim mt-1 text-sm max-w-md">
          Use MetaMask, Rabby, Coinbase, or scan from a mobile wallet via WalletConnect.
          Your keys never leave your device.
        </p>
      </div>
      <ConnectButton />
      <div className="text-xs text-text-mute">
        Default network is <strong>Sepolia testnet</strong> — switch to mainnet only when you're ready.
      </div>
    </div>
  );
}
