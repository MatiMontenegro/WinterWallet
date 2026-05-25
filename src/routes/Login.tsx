import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useToast } from "../components/Toast";
import { getSupabase, isSupabaseEnabled } from "../lib/supabase";
import { ENV } from "../env";

type Mode = "password" | "magic";

export default function LoginRoute() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseEnabled) {
      toast("Supabase is not configured. Continue without an account from the home screen.", "warn");
      return;
    }
    setSubmitting(true);
    try {
      const sb = getSupabase()!;
      if (mode === "password") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast("Welcome back ❄", "ok");
        navigate("/");
      } else {
        const { error } = await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${ENV.appUrl}/auth/callback` },
        });
        if (error) throw error;
        toast("Magic link sent — check your inbox.", "ok");
      }
    } catch (err) {
      toast((err as Error).message, "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell subtitle="Welcome back. Sign in with your email.">
      <div className="card-glass p-6 flex flex-col gap-5">
        {/* mode tabs */}
        <div className="flex gap-1 bg-bg-2 rounded-full p-1 border border-line">
          {(["password", "magic"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-sm transition ${mode === m ? "bg-accent text-[#0b0d18] font-semibold" : "text-text-dim hover:text-text"}`}
            >
              {m === "password" ? "Password" : "Magic link"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            type="email"
            inputMode="email"
            autoComplete="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode === "password" && (
            <Field
              type="password"
              autoComplete="current-password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          )}
          <Button type="submit" loading={submitting} block size="lg">
            {mode === "password" ? "Sign in" : "Send magic link"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot" className="text-text-dim hover:text-accent">Forgot password?</Link>
          <Link to="/signup" className="text-accent hover:underline">Create account</Link>
        </div>
      </div>

      <p className="text-text-mute text-xs text-center">
        New to crypto? Start on <strong>Sepolia testnet</strong> — no real money required.
      </p>
    </AuthShell>
  );
}
