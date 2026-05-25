// Sign-In With Ethereum (EIP-4361) message builder + Supabase exchange.

import { ENV } from "../env";
import { getSupabase } from "./supabase";

function randomNonce(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface SiweMessageInput {
  address: string;
  chainId: number;
  domain?: string;
  uri?: string;
  statement?: string;
}

export function buildSiweMessage(i: SiweMessageInput): { message: string; nonce: string } {
  const domain = i.domain ?? window.location.host;
  const uri = i.uri ?? window.location.origin;
  const statement = i.statement ?? `Sign in to ${ENV.appName}`;
  const nonce = randomNonce();
  const issuedAt = new Date().toISOString();
  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    i.address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${i.chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
  return { message, nonce };
}

/**
 * Exchange a SIWE signature for a Supabase session.
 *
 * Returns the access/refresh tokens; the caller should call
 * `supabase.auth.setSession(...)` to install them.
 */
export async function exchangeSiwe(
  message: string,
  signature: string,
  address: string,
  chainId: number,
): Promise<{ access_token: string; refresh_token: string; expires_at: number; user_id: string }> {
  if (!ENV.siweVerifyUrl) throw new Error("SIWE endpoint not configured.");
  const r = await fetch(ENV.siweVerifyUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, signature, address, chainId }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`SIWE verification failed (${r.status}): ${txt}`);
  }
  return r.json();
}

export async function siweAndSetSession(
  message: string,
  signature: string,
  address: string,
  chainId: number,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured.");
  const { access_token, refresh_token } = await exchangeSiwe(message, signature, address, chainId);
  const { error } = await sb.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}
