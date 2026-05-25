import { useAccount, useChainId } from "wagmi";
import { useTransactionHistory } from "../hooks/useTransactionHistory";
import { fmtNumber, shortAddress } from "../lib/utils";
import { explorerTxUrl } from "../lib/chains";
import { isSupabaseEnabled } from "../lib/supabase";

export function HistoryCard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: rows = [], isLoading } = useTransactionHistory({
    walletAddress: address,
    chainId,
    enabled: Boolean(address),
  });

  return (
    <section className="card-glass p-6">
      <header className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Transactions</h2>
        <span className="text-xs text-text-mute">
          {isSupabaseEnabled ? `${rows.length} record${rows.length === 1 ? "" : "s"} · RLS-protected` : "Sign in to enable history"}
        </span>
      </header>

      {isLoading && <div className="h-20 shimmer rounded-lg" />}

      {!isLoading && rows.length === 0 && (
        <p className="text-text-dim text-sm">No transactions yet. Send something to see it here.</p>
      )}

      {!isLoading && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const out = r.direction === "out";
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-lg bg-bg-2 border border-line p-3">
                <div
                  className={`h-9 w-9 grid place-items-center rounded-full font-bold ${out ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent"}`}
                  aria-hidden
                >
                  {out ? "↑" : "↓"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm">
                    {fmtNumber(r.amount, 6)} {r.asset_symbol}
                    {r.fee_amount && (
                      <span className="ml-2 text-xs text-text-mute">(fee {fmtNumber(r.fee_amount, 6)})</span>
                    )}
                  </p>
                  <p className="text-xs text-text-dim font-mono">{shortAddress(r.counterparty)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full
                      ${r.status === "confirmed" ? "bg-accent/15 text-accent" :
                        r.status === "pending"   ? "bg-warn/15 text-warn"     :
                                                   "bg-danger/15 text-danger"}`}
                  >
                    {r.status}
                  </span>
                  <a
                    href={explorerTxUrl(r.chain_id, r.tx_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    view ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
