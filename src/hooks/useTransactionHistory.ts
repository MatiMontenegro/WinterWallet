// Reads tx history from the RLS-protected `transactions` table.
// When Supabase is not configured, returns an empty list — tx history will
// only live in memory for the current session.

import { useQuery } from "@tanstack/react-query";
import { getSupabase, type DBTransaction } from "../lib/supabase";

export function useTransactionHistory(opts: { walletAddress?: string; chainId?: number; enabled?: boolean }) {
  const { walletAddress, chainId, enabled = true } = opts;
  return useQuery({
    queryKey: ["transactions", walletAddress?.toLowerCase(), chainId],
    enabled: enabled && Boolean(walletAddress),
    refetchInterval: 30_000,
    queryFn: async (): Promise<DBTransaction[]> => {
      const sb = getSupabase();
      if (!sb) return [];
      let q = sb
        .from("transactions")
        .select("*")
        .eq("wallet_address", walletAddress!.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(50);
      if (chainId) q = q.eq("chain_id", chainId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DBTransaction[];
    },
  });
}
