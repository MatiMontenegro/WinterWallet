import { useAccount, useBalance, useChainId } from "wagmi";
import { formatEther } from "viem";
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { useTokenBalance } from "../hooks/useTokenBalance";
import { getChainMeta, explorerAddressUrl } from "../lib/chains";
import { fmtNumber, fmtUsd, shortAddress, copy } from "../lib/utils";
import { useToast } from "./Toast";
import { getPrices } from "../lib/prices";

export function BalanceCard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const meta = chainId ? getChainMeta(chainId) : null;
  const native = useBalance({ address, chainId });
  const usdc = useTokenBalance(meta?.tokens.USDC?.address, address, meta?.tokens.USDC?.decimals ?? 6);
  const toast = useToast();

  const [prices, setPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    getPrices([meta.chain.nativeCurrency.symbol, "USDC"]).then((p) => { if (!cancelled) setPrices(p); });
    return () => { cancelled = true; };
  }, [meta?.chain.id]);

  if (!meta || !address) return <BalanceCardSkeleton />;
  const sym = meta.chain.nativeCurrency.symbol;
  const nativeAmt = native.data ? Number(formatEther(native.data.value)) : 0;
  const usdcAmt = Number(usdc.formatted);

  return (
    <section className="card-glass p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-dim">Total balance</p>
          <p className="text-3xl font-bold mt-1">
            {fmtUsd((nativeAmt * (prices[sym] ?? 0)) + (usdcAmt * (prices.USDC ?? 0)))}
          </p>
        </div>
        <button
          onClick={() => { native.refetch(); usdc.refetch(); }}
          className="rounded-full p-2 bg-bg-2 hover:bg-bg-3 text-text-dim hover:text-text transition"
          aria-label="Refresh balances"
          title="Refresh"
        >↻</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-bg-2 border border-line p-4">
          <p className="text-xs text-text-dim uppercase tracking-wider">{sym}</p>
          <p className="font-mono text-2xl font-semibold mt-1">{fmtNumber(nativeAmt, 5)}</p>
          <p className="text-xs text-text-mute mt-1">≈ {fmtUsd(nativeAmt * (prices[sym] ?? 0))}</p>
        </div>
        <div className="rounded-xl bg-bg-2 border border-line p-4">
          <p className="text-xs text-text-dim uppercase tracking-wider">USDC</p>
          <p className="font-mono text-2xl font-semibold mt-1">{fmtNumber(usdcAmt, 2)}</p>
          <p className="text-xs text-text-mute mt-1">≈ {fmtUsd(usdcAmt * (prices.USDC ?? 0))}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-dim">
        <span>Receive at</span>
        <code className="font-mono bg-bg-2 border border-line rounded-full px-2 py-1">{shortAddress(address, 8, 6)}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const ok = await copy(address);
            toast(ok ? "Address copied." : "Copy failed.", ok ? "ok" : "warn");
          }}
        >
          Copy
        </Button>
        <a
          href={explorerAddressUrl(meta.chain.id, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-accent hover:underline"
        >
          Explorer ↗
        </a>
      </div>

      {meta.isTestnet ? (
        <div className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
          You're on a <strong>testnet</strong>. Funds here have no monetary value.
          {meta.faucets?.[0] && <> · <a href={meta.faucets[0]} target="_blank" rel="noopener noreferrer" className="underline">Get test {sym} ↗</a></>}
        </div>
      ) : (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          ⚠ <strong>Mainnet active.</strong> Transactions move real cryptocurrency and are irreversible.
        </div>
      )}
    </section>
  );
}

function BalanceCardSkeleton() {
  return <div className="card-glass p-6"><div className="h-32 shimmer rounded-lg" /></div>;
}
