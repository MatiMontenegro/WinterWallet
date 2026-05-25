import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "./lib/wagmi";
import { ToastProvider } from "./components/Toast";
import { useAuth } from "./hooks/useAuth";
import { isSupabaseEnabled } from "./lib/supabase";

const Dashboard = lazy(() => import("./routes/Dashboard"));
const Login = lazy(() => import("./routes/Login"));
const Signup = lazy(() => import("./routes/Signup"));
const Forgot = lazy(() => import("./routes/ForgotPassword"));
const AuthCallback = lazy(() => import("./routes/AuthCallback"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="inline-block h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

/** When Supabase is configured, gate every wallet route behind a logged-in
 * session. When it's not configured, all routes are public (the wallet still
 * works fully — you just won't have persisted history). */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, enabled } = useAuth();
  if (!enabled) return <>{children}</>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ accentColor: "#7cf7c8", accentColorForeground: "#0b0d18", borderRadius: "medium" })}
          modalSize="compact"
          showRecentTransactions
        >
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
                  <Route path="/signup" element={<RedirectIfAuthed><Signup /></RedirectIfAuthed>} />
                  <Route path="/forgot" element={<Forgot />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/reset" element={<AuthCallback />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
              {!isSupabaseEnabled && <DemoBadge />}
            </BrowserRouter>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function DemoBadge() {
  return (
    <div
      className="fixed left-4 z-30 rounded-full bg-warn/15 border border-warn/40 text-warn text-[10px] uppercase tracking-wider px-2 py-1"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      title="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable accounts and history."
    >
      demo mode · no backend
    </div>
  );
}
