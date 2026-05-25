// Send flow with optional FeeRouter routing.
//
// If a FeeRouter address is configured for the active chain, sends are routed
// through the contract — a single tx, single signature, atomic split between
// the recipient and the operator. Disclosed fee shown clearly in the review
// dialog. Without a router, we fall back to direct transfers.

import { useState, type FormEvent } from "react";
import { useAccount, useChainId, useWriteContract, useSendTransaction, usePublicClient, useBalance } from "wagmi";
import { erc20Abi, formatEther, formatUnits, isAddress, parseEther, type Address } from "viem";
import { Button } from "./Button";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { useTokenBalance } from "../hooks/useTokenBalance";
import { getChainMeta, feeRouterFor, explorerTxUrl } from "../lib/chains";
import { ENV } from "../env";
import { FEE_ROUTER_ABI, encodeSendNative, quoteNative, quoteErc20 } from "../lib/feeRouter";
import { fmtNumber, shortAddress } from "../lib/utils";
import { getSupabase } from "../lib/supabase";

type Asset = "native" | "USDC";

export function SendCard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const meta = chainId ? getChainMeta(chainId) : null;
  const router = chainId ? feeRouterFor(chainId) : undefined;
  const toast = useToast();

  const [asset, setAsset] = useState<Asset>("native");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [lastHash, setLastHash] = useState<`0x${string}` | null>(null);

  const { data: nativeBal } = useBalance({ address, chainId });
  const usdc = useTokenBalance(meta?.tokens.USDC?.address, address, meta?.tokens.USDC?.decimals ?? 6);

  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });

  if (!meta || !address) return null;

  const sym = meta.chain.nativeCurrency.symbol;
  const decimals = asset === "native" ? meta.chain.nativeCurrency.decimals : meta.tokens.USDC?.decimals ?? 6;
  const useRouter = Boolean(router);
  const quote =
    !amount || Number(amount) <= 0 ? null
    : asset === "native" ? quoteNative(amount, ENV.feeBps)
    : quoteErc20(amount, decimals, ENV.feeBps);

  function setMax() {
    if (asset === "native" && nativeBal) {
      // Reserve a tiny buffer for gas. User can still edit.
      const buffer = parseEther("0.0005");
      const usable = nativeBal.value > buffer ? nativeBal.value - buffer : 0n;
      setAmount(formatEther(usable));
    } else if (asset === "USDC" && usdc.raw != null) {
      setAmount(formatUnits(usdc.raw, decimals));
    }
  }

  function onContinue(e: FormEvent) {
    e.preventDefault();
    if (!isAddress(to)) return toast("Invalid recipient address.", "warn");
    if (!quote || quote.total <= 0n) return toast("Enter an amount.", "warn");
    setReviewing(true);
  }

  async function execute() {
    if (!quote || !meta) return;
    setBusy(true);
    try {
      let hash: `0x${string}`;

      if (asset === "native") {
        if (useRouter && router) {
          hash = await sendTransactionAsync({
            chainId: meta.chain.id,
            to: router,
            value: quote.total,
            data: encodeSendNative(to as Address),
          });
        } else {
          hash = await sendTransactionAsync({
            chainId: meta.chain.id,
            to: to as Address,
            value: quote.total,
          });
        }
      } else {
        const tokenAddr = meta.tokens.USDC!.address;
        if (useRouter && router) {
          // Two writes: approve(router, total), then sendToken(token, to, total).
          // We need the approval to be at least `quote.total`.
          const allowance = (await publicClient!.readContract({
            abi: erc20Abi, address: tokenAddr, functionName: "allowance", args: [address!, router],
          })) as bigint;
          if (allowance < quote.total) {
            const approveHash = await writeContractAsync({
              chainId: meta.chain.id,
              abi: erc20Abi, address: tokenAddr, functionName: "approve",
              args: [router, quote.total],
            });
            await publicClient!.waitForTransactionReceipt({ hash: approveHash });
            toast("Allowance set ✓", "ok");
          }
          hash = await writeContractAsync({
            chainId: meta.chain.id,
            abi: FEE_ROUTER_ABI, address: router, functionName: "sendToken",
            args: [tokenAddr, to as Address, quote.total],
          });
        } else {
          hash = await writeContractAsync({
            chainId: meta.chain.id,
            abi: erc20Abi, address: tokenAddr, functionName: "transfer",
            args: [to as Address, quote.total],
          });
        }
      }

      setLastHash(hash);
      toast(`Broadcast: ${shortAddress(hash, 10, 6)}`, "ok", 6000);

      // Persist a pending row (RLS scoped to user_id via Supabase auth).
      const sb = getSupabase();
      if (sb) {
        try {
          const userRes = await sb.auth.getUser();
          const userId = userRes.data.user?.id;
          if (userId) {
            await sb.from("transactions").insert({
              user_id: userId,
              wallet_address: address!.toLowerCase(),
              tx_hash: hash,
              chain_id: meta.chain.id,
              direction: "out",
              counterparty: (to as string).toLowerCase(),
              amount: amount,
              asset_symbol: asset === "native" ? sym : "USDC",
              asset_address: asset === "native" ? null : meta.tokens.USDC!.address,
              fee_amount: useRouter ? formatUnits(quote.fee, decimals) : null,
              fee_bps: useRouter ? ENV.feeBps : null,
              fee_recipient: useRouter ? router! : null,
              status: "pending",
            });
          }
        } catch (e) { console.warn("persist tx failed", e); }
      }

      // Watch for receipt and update.
      publicClient!.waitForTransactionReceipt({ hash }).then(async (receipt) => {
        const ok = receipt.status === "success";
        toast(ok ? "Confirmed ✓" : "Reverted ✗", ok ? "ok" : "warn");
        if (sb) {
          await sb.from("transactions")
            .update({
              status: ok ? "confirmed" : "reverted",
              block_number: Number(receipt.blockNumber),
              gas_used: receipt.gasUsed.toString(),
            })
            .eq("tx_hash", hash);
        }
      }).catch((err) => toast(`Tx failed: ${err.message}`, "warn"));

      // Reset form
      setReviewing(false);
      setTo("");
      setAmount("");
    } catch (err) {
      toast((err as Error).message, "warn");
    } finally {
      setBusy(false);
    }
  }

  const feeDecimal = quote ? Number(formatUnits(quote.fee, decimals)) : 0;
  const recipientDecimal = quote ? Number(formatUnits(quote.recipientAmount, decimals)) : 0;

  return (
    <section className="card-glass p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Send</h2>
        <div className="text-xs text-text-dim">
          {useRouter
            ? <>via FeeRouter · <span className="text-accent">{(ENV.feeBps / 100).toFixed(2)}% fee</span></>
            : <>direct · no fee</>
          }
        </div>
      </div>

      <form onSubmit={onContinue} className="flex flex-col gap-4">
        <div className="flex gap-1 bg-bg-2 rounded-full p-1 border border-line">
          {(["native", "USDC"] as Asset[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAsset(a)}
              className={`flex-1 rounded-full py-2 text-sm transition ${asset === a ? "bg-accent text-[#0b0d18] font-semibold" : "text-text-dim hover:text-text"}`}
            >
              {a === "native" ? sym : "USDC"}
            </button>
          ))}
        </div>

        <Field
          label="Recipient address"
          placeholder="0x…"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />

        <Field
          label="Amount"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          suffix={
            <Button type="button" size="sm" variant="ghost" onClick={setMax}>Max</Button>
          }
          hint={useRouter && quote
            ? `${fmtNumber(recipientDecimal, 6)} reach the recipient · fee ${fmtNumber(feeDecimal, 6)} ${asset === "native" ? sym : "USDC"}`
            : undefined
          }
        />

        <Button type="submit" block size="lg" disabled={!amount || !to}>
          Review &amp; send
        </Button>
      </form>

      {lastHash && (
        <p className="text-xs text-text-dim">
          Last tx:{" "}
          <a className="text-accent underline" href={explorerTxUrl(meta.chain.id, lastHash)} target="_blank" rel="noopener noreferrer">
            {shortAddress(lastHash, 10, 6)} ↗
          </a>
        </p>
      )}

      <Modal
        open={reviewing}
        onClose={() => setReviewing(false)}
        title="Confirm transaction"
        actions={
          <>
            <Button variant="ghost" onClick={() => setReviewing(false)} disabled={busy}>Cancel</Button>
            <Button variant={meta.isTestnet ? "primary" : "danger"} loading={busy} onClick={execute}>
              {meta.isTestnet ? "Send" : "Send (mainnet)"}
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-text-dim">Network</dt>
          <dd>{meta.shortName}{!meta.isTestnet && <strong className="text-warn"> · real money</strong>}</dd>
          <dt className="text-text-dim">Asset</dt>
          <dd>{asset === "native" ? sym : "USDC"}</dd>
          <dt className="text-text-dim">To</dt>
          <dd className="font-mono break-all">{to}</dd>
          <dt className="text-text-dim">Amount</dt>
          <dd className="font-mono">{amount} {asset === "native" ? sym : "USDC"}</dd>
          {useRouter && quote && (
            <>
              <dt className="text-text-dim">Service fee ({(ENV.feeBps / 100).toFixed(2)}%)</dt>
              <dd className="font-mono">{fmtNumber(feeDecimal, 6)} {asset === "native" ? sym : "USDC"}</dd>
              <dt className="text-text-dim">Recipient gets</dt>
              <dd className="font-mono">{fmtNumber(recipientDecimal, 6)} {asset === "native" ? sym : "USDC"}</dd>
            </>
          )}
        </dl>
        {asset === "USDC" && useRouter && (
          <p className="text-xs text-text-mute mt-3">
            ERC-20 sends through the router need a one-time on-chain <code>approve</code>.
            We'll prompt for it automatically if your allowance is too low.
          </p>
        )}
        <p className="text-xs text-text-mute mt-3">Once broadcast, this transaction cannot be reversed.</p>
      </Modal>
    </section>
  );
}
