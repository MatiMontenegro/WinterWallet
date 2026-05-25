import { Link, useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "./AuthShell";
import { Button } from "./Button";
import { useAuth, signOut } from "../hooks/useAuth";
import { useToast } from "./Toast";

export function TopBar() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-bg-0/70 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-info grid place-items-center text-[#0b0d18] font-bold transition group-hover:scale-105">❄</div>
          <span className="font-bold tracking-tight">WinterWallet</span>
        </Link>

        <div className="flex items-center gap-2">
          <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} />
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                toast("Signed out.", "info");
                navigate("/login");
              }}
              title={user?.email ?? "Sign out"}
            >
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export { Logo };
