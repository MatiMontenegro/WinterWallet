// Supabase Edge Function: siwe-verify
//
// POST /functions/v1/siwe-verify
//   { message: string, signature: string, address: string, chainId: number }
//
//   1. Parses the EIP-4361 SIWE message and runs basic sanity checks.
//   2. Recovers the signer with ethers.verifyMessage and confirms it matches
//      the claimed address.
//   3. Looks up (or creates) a Supabase auth user keyed to that address, and
//      stores `wallet_address` in `app_metadata` so it ends up as a JWT claim.
//   4. Generates a magic-link session and returns its access/refresh tokens.
//
// Required secrets (set with `supabase secrets set ...`):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - ALLOWED_ORIGIN              (e.g. https://yourapp.example or *)
//   - ALLOWED_DOMAIN              (must match the SIWE `domain` field)
//
// Deploy:
//   supabase functions deploy siwe-verify --no-verify-jwt
//   (no JWT required because anonymous users invoke this to log in)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ethers } from "https://esm.sh/ethers@6.13.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const ALLOWED_DOMAIN = Deno.env.get("ALLOWED_DOMAIN") ?? "";

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

interface SiweFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

function parseSiwe(message: string): SiweFields {
  const lines = message.split("\n");
  if (lines.length < 9) throw new Error("Malformed SIWE message");
  const m = lines[0].match(/^(.+?) wants you to sign in with your Ethereum account:$/);
  if (!m) throw new Error("Bad SIWE preamble");
  const get = (prefix: string) => {
    const line = lines.find((l) => l.startsWith(prefix));
    if (!line) throw new Error(`Missing field: ${prefix}`);
    return line.slice(prefix.length).trim();
  };
  return {
    domain: m[1].trim(),
    address: lines[1].trim(),
    statement: lines[3].trim(),
    uri: get("URI:"),
    version: get("Version:"),
    chainId: Number(get("Chain ID:")),
    nonce: get("Nonce:"),
    issuedAt: get("Issued At:"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { message?: string; signature?: string; address?: string; chainId?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const { message, signature, address, chainId } = body;
  if (!message || !signature || !address || !chainId) {
    return json({ error: "missing fields" }, 400);
  }

  // 1. Parse and sanity-check the SIWE message.
  let fields: SiweFields;
  try {
    fields = parseSiwe(message);
  } catch (e) {
    return json({ error: `bad message: ${(e as Error).message}` }, 400);
  }
  if (ALLOWED_DOMAIN && fields.domain !== ALLOWED_DOMAIN) {
    return json({ error: "domain mismatch" }, 401);
  }
  if (fields.address.toLowerCase() !== address.toLowerCase()) {
    return json({ error: "address mismatch" }, 401);
  }
  if (Number(fields.chainId) !== Number(chainId)) {
    return json({ error: "chainId mismatch" }, 401);
  }
  const issued = Date.parse(fields.issuedAt);
  if (!Number.isFinite(issued) || Date.now() - issued > NONCE_TTL_MS) {
    return json({ error: "message expired" }, 401);
  }
  if (Date.now() + 60_000 < issued) {
    return json({ error: "issuedAt is in the future" }, 401);
  }

  // 2. Verify the signature.
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch (e) {
    return json({ error: `signature error: ${(e as Error).message}` }, 401);
  }
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return json({ error: "signature does not match address" }, 401);
  }

  const wallet = address.toLowerCase();
  const synthEmail = `${wallet}@wallet.local`;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Upsert auth user. We embed wallet_address in app_metadata so it is
  //    signed into the JWT and visible to RLS via auth.jwt().
  const { data: existing } = await admin.auth.admin.listUsers({
    page: 1, perPage: 1, /* @ts-ignore - filter not in typed */ filter: `email.eq.${synthEmail}`,
  } as never);
  let userId = existing?.users?.find((u) => u.email === synthEmail)?.id;

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: synthEmail,
      email_confirm: true,
      app_metadata: { wallet_address: wallet, provider: "siwe" },
      user_metadata: { wallet_address: wallet },
    });
    if (createErr) return json({ error: `createUser: ${createErr.message}` }, 500);
    userId = created.user.id;
  } else {
    // Refresh the claim in case the field was missing.
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { wallet_address: wallet, provider: "siwe" },
    });
  }

  // 4. Mint a session by generating a magiclink and exchanging the OTP token
  //    server-side. This avoids sending an email and yields real access /
  //    refresh tokens.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: synthEmail,
  });
  if (linkErr || !link?.properties) {
    return json({ error: `generateLink: ${linkErr?.message ?? "no link"}` }, 500);
  }

  const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyErr || !verified.session) {
    return json({ error: `verifyOtp: ${verifyErr?.message ?? "no session"}` }, 500);
  }

  return json({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    expires_at: verified.session.expires_at,
    user_id: userId,
    wallet_address: wallet,
  });
});
