import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useToast } from "../components/Toast";
import { getSupabase, isSupabaseEnabled } from "../lib/supabase";
import { ENV } from "../env";

export default function SignupRoute() {
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const strength = scorePassword(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseEnabled) {
      toast("Supabase is not configured. The hosted version will let you sign up.", "warn");
      return;
    }
    if (password !== confirm) return toast("Passwords do not match.", "warn");
    if (strength.score < 3) return toast(strength.label, "warn");

    setSubmitting(true);
    try {
      const sb = getSupabase()!;
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name || null },
          emailRedirectTo: `${ENV.appUrl}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
      toast("Check your inbox to confirm your email ✉", "ok");
    } catch (err) {
      toast((err as Error).message, "warn");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell subtitle="One step left.">
        <div className="card-glass p-6 flex flex-col items-center gap-4 text-center">
          <div className="text-5xl animate-float" aria-hidden>📬</div>
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-text-dim text-sm">
            We just sent a confirmation link to <strong className="text-text">{email}</strong>.
            Click it to activate your account, then come back here to sign in.
          </p>
          <Button variant="ghost" onClick={() => navigate("/login")} block>
            Back to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Create your account in 30 seconds.">
      <div className="card-glass p-6 flex flex-col gap-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            type="text"
            autoComplete="name"
            label="Display name (optional)"
            placeholder="Satoshi N."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
          <div className="flex flex-col gap-2">
            <Field
              type="password"
              autoComplete="new-password"
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {password && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${strength.color}`}
                    style={{ width: `${(strength.score / 4) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-text-dim w-20 text-right">{strength.label}</span>
              </div>
            )}
          </div>
          <Field
            type="password"
            autoComplete="new-password"
            label="Confirm password"
            placeholder="Type it again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            error={confirm && confirm !== password ? "Passwords do not match" : undefined}
          />

          <Button type="submit" loading={submitting} block size="lg">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-text-dim">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>

      <p className="text-text-mute text-xs text-center">
        Your password protects your account, not your crypto. The wallet itself is non-custodial — you control the keys.
      </p>
    </AuthShell>
  );
}

function scorePassword(p: string): { score: number; label: string; color: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  if (score >= 4) return { score: 4, label: "Strong", color: "bg-accent" };
  if (score === 3) return { score: 3, label: "Good", color: "bg-info" };
  if (score === 2) return { score: 2, label: "Weak", color: "bg-warn" };
  return { score: 1, label: "Too weak", color: "bg-danger" };
}
