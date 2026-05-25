import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useToast } from "../components/Toast";
import { getSupabase, isSupabaseEnabled } from "../lib/supabase";
import { ENV } from "../env";

export default function ForgotPasswordRoute() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseEnabled) {
      toast("Supabase is not configured.", "warn");
      return;
    }
    setSubmitting(true);
    try {
      const sb = getSupabase()!;
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${ENV.appUrl}/auth/reset`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast((err as Error).message, "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell subtitle="Reset your password.">
      <div className="card-glass p-6 flex flex-col gap-4">
        {sent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-5xl" aria-hidden>✉</div>
            <p className="text-text-dim text-sm">If an account with that email exists, a reset link is on its way.</p>
            <Link to="/login" className="text-accent hover:underline text-sm">Back to sign in</Link>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field type="email" inputMode="email" autoComplete="email" label="Email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" loading={submitting} block size="lg">Send reset link</Button>
            </form>
            <Link to="/login" className="text-center text-sm text-text-dim hover:text-accent">Back to sign in</Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
