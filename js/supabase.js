// Optional Supabase integration.
//
// When configured, every persisted read and write goes through Postgres RLS:
// the database itself rejects requests for rows that do not belong to the
// signed-in wallet. The anon key shipped to the browser cannot bypass RLS.
//
// Auth flow:
//   1. User signs an EIP-4361 (SIWE) message in their wallet.
//   2. We POST { message, signature, address } to a Supabase Edge Function.
//   3. The function verifies the signature with ethers.verifyMessage, then
//      issues a Supabase session token (custom JWT) carrying
//      `wallet_address` as a claim.
//   4. RLS policies compare `auth.jwt()->>'wallet_address'` against the row's
//      `wallet_address` column.
//
// Without Supabase configured, all functions degrade to no-ops and history
// is read straight from chain logs only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig, isSupabaseConfigured } from "./config.js";
import { signIn as siweSignIn } from "./siwe.js";

let _client = null;

export function getClient() {
  if (!isSupabaseConfigured()) return null;
  if (_client) return _client;
  const { url, anonKey } = getConfig().supabase;
  _client = createClient(url, anonKey, {
    auth: { persistSession: true, storageKey: "ww:supabase:session" },
  });
  return _client;
}

export function isReady() {
  return isSupabaseConfigured();
}

// --------------------------------------------------------------- SIWE login

export async function siweLogin({ address, chainId }) {
  if (!isSupabaseConfigured()) return null;
  const client = getClient();
  const { siweEndpoint } = getConfig().supabase;
  if (!siweEndpoint) throw new Error("siweEndpoint is not configured.");

  const { message, signature } = await siweSignIn({ address, chainId });

  const r = await fetch(siweEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, signature, address, chainId }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`SIWE verification failed: ${r.status} ${text}`);
  }
  const { access_token, refresh_token } = await r.json();
  const { error } = await client.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return client.auth.getUser();
}

export async function siweLogout() {
  const client = getClient();
  if (client) await client.auth.signOut();
}

export async function isSignedIn() {
  const client = getClient();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data?.session);
}

// ------------------------------------------------------- transactions table

export async function recordTransaction(tx) {
  const client = getClient();
  if (!client) return { skipped: true };
  // RLS will enforce that wallet_address matches the JWT claim.
  const { data, error } = await client.from("transactions").insert(tx).select().single();
  if (error) throw error;
  return data;
}

export async function listTransactions({ chainId, limit = 50 } = {}) {
  const client = getClient();
  if (!client) return [];
  let q = client
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (chainId) q = q.eq("chain_id", chainId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// --------------------------------------------------------- address book api

export async function listContacts() {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from("address_book").select("*").order("label");
  if (error) throw error;
  return data ?? [];
}

export async function addContact({ label, address, chainId, notes }) {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured.");
  const { data, error } = await client
    .from("address_book")
    .insert({ label, contact_address: address, chain_id: chainId, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id) {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured.");
  const { error } = await client.from("address_book").delete().eq("id", id);
  if (error) throw error;
}
