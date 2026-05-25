// Handles Supabase email confirmation, password reset, and magic-link
// redirects. Supabase ships the session in the URL hash; the SDK picks it up
// automatically via `detectSessionInUrl: true` (the default).

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { getSupabase } from "../lib/supabase";

export default function AuthCallbackRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { navigate("/login"); return; }
    // detectSessionInUrl runs at client init; just give it a tick then route.
    const t = window.setTimeout(async () => {
      const { data } = await sb.auth.getSession();
      navigate(data.session ? "/" : "/login", { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <AuthShell subtitle="Signing you in…">
      <div className="card-glass p-8 text-center">
        <div className="inline-block h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
        <p className="mt-4 text-text-dim text-sm">Verifying your magic link…</p>
      </div>
    </AuthShell>
  );
}
