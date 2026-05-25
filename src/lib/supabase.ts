import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, supabaseConfigured } from "../env";

export type DBProfile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  default_chain_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DBWallet = {
  id: number;
  user_id: string;
  address: string;
  label: string | null;
  is_primary: boolean;
  created_at: string;
};

export type DBTransaction = {
  id: number;
  user_id: string;
  wallet_address: string;
  tx_hash: string;
  chain_id: number;
  direction: "in" | "out";
  counterparty: string;
  amount: string;
  asset_symbol: string;
  asset_address: string | null;
  fee_amount: string | null;
  fee_bps: number | null;
  fee_recipient: string | null;
  status: "pending" | "confirmed" | "reverted";
  block_number: number | null;
  gas_used: string | null;
  created_at: string;
};

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (_client) return _client;
  _client = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "ww:sb:session" },
  });
  return _client;
}

export const isSupabaseEnabled = supabaseConfigured;
