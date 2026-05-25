// FeeRouter contract bindings + send helpers.
//
// The contract (see /contracts/FeeRouter.sol) has two entry points:
//   sendNative(to)      payable                       — for ETH/MATIC transfers
//   sendToken(token, to, totalAmount)                 — for ERC-20 transfers
// Both deduct `feeBps` and forward the remainder. Fee accumulates on the
// contract; `withdraw(token)` (owner only) sweeps it.
//
// Why route through a contract instead of charging fees in two transactions?
//   - Single user signature, single gas payment.
//   - Atomic: either the recipient + the operator both get paid, or neither.
//   - Auditable on-chain: anyone can verify the fee rate.
//
// The contract enforces a hard cap of 100 bps (1%) so the operator cannot
// secretly raise the fee beyond what was disclosed at deployment.

import { type Address, type Hash, encodeFunctionData, parseEther, parseUnits, erc20Abi } from "viem";
import { ENV } from "../env";

export const FEE_ROUTER_ABI = [
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "sendNative",
    stateMutability: "payable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "sendToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "totalAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "accumulated",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Forwarded",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "totalAmount", type: "uint256" },
      { indexed: false, name: "fee", type: "uint256" },
    ],
  },
] as const;

export interface NativeQuote {
  total: bigint;
  fee: bigint;
  recipientAmount: bigint;
  feeBps: number;
}

export function quoteNative(amount: string, feeBps: number = ENV.feeBps): NativeQuote {
  const total = parseEther(amount);
  const fee = (total * BigInt(feeBps)) / 10_000n;
  return { total, fee, recipientAmount: total - fee, feeBps };
}

export function quoteErc20(amount: string, decimals: number, feeBps: number = ENV.feeBps): NativeQuote {
  const total = parseUnits(amount, decimals);
  const fee = (total * BigInt(feeBps)) / 10_000n;
  return { total, fee, recipientAmount: total - fee, feeBps };
}

/** ABI-encode a `sendNative(address)` call for `writeContract`. */
export function encodeSendNative(to: Address): `0x${string}` {
  return encodeFunctionData({ abi: FEE_ROUTER_ABI, functionName: "sendNative", args: [to] });
}

/**
 * For ERC-20: the user must `approve(router, totalAmount)` first, then call
 * `sendToken(token, to, totalAmount)`. We export the calls; the UI handles
 * the two-step (approve → send) when needed.
 */
export const erc20ApproveAbi = erc20Abi;

export type Hex = Hash;
