# Monetization

This is the honest, math-based answer to *"how do I earn from this project?"*

## The model

WinterWallet's primary revenue stream is a **transparent commission on
transfers**, routed through the `FeeRouter` smart contract (see
[`contracts/FeeRouter.sol`](../contracts/FeeRouter.sol)). Every time a user
sends through the wallet:

1. The user signs **one** transaction that goes to your `FeeRouter`.
2. The contract splits the amount: **(100% − feeBps)** to the recipient,
   **feeBps** stays in the contract.
3. You sweep accumulated fees with `withdraw(token)` from the owner address.

Hard-coded ceiling: **1.00% (100 bps)**. You set the actual rate at deployment
(`VITE_FEE_BPS`, default `30` = 0.30%).

## The numbers

| Users | Sends/user/month | Avg send (USD) | Fee | Monthly revenue |
| ----- | ---------------: | -------------: | --: | --------------: |
| 100   | 2                | $50            | 0.30% | **$3** |
| 100   | 4                | $200           | 0.30% | **$24** |
| 1,000 | 4                | $200           | 0.30% | **$240** |
| 1,000 | 8                | $500           | 0.30% | **$1,200** |
| 10,000 | 8               | $500           | 0.30% | **$12,000** |
| 10,000 | 8               | $500           | 1.00% (max) | **$40,000** |

Math: `users × sends × avg × feeBps / 10000`.

**Reality check.** Transfer fees alone are a hard sell for a Web3 wallet
because anyone can sideload MetaMask and pay zero. Users keep paying you
when **the UX is better than the alternative.** That's what this codebase
optimizes for: one-tap install on iPhone, magic-link login, real-time
balances, single-signature sends. Don't expect to convert MetaMask power
users; expect to convert people who don't have a wallet yet.

## Why a smart contract rather than two txs?

The naive "send to recipient + send fee to operator" approach is:

- ❌ Two user signatures (UX friction).
- ❌ Two gas payments (the user notices).
- ❌ Non-atomic: one tx can succeed while the other fails.
- ❌ Easy to circumvent — the user can just skip the fee tx.

The router collapses it to:

- ✅ One signature, one gas payment.
- ✅ Atomic: the contract guarantees the split.
- ✅ Cannot be bypassed: the fee is structurally part of the same call.
- ✅ Verifiable on-chain: the bytecode shows the cap and the rate.

## Stacking additional revenue (future work — beyond this MVP)

The transfer fee is the foundation. Where serious wallet revenue actually
comes from:

| Stream | Typical rate | What it needs |
| --- | --- | --- |
| **Swaps** (0x, 1inch, Uniswap routes) | 0.5 – 1.0% | Integrate aggregator with `feeRecipient`. The aggregator returns quotes that already include your fee. |
| **Bridging** (Across, Hop, Stargate, Squid) | 0.1 – 0.5% | Partner program; some accept `referrer` addresses. |
| **Staking** (Lido, Rocket Pool) | 0.25 – 1.0% of yield | UI for stake/unstake with your address as `referral`. |
| **On/off-ramp** (MoonPay, Transak, Ramp) | 0.5 – 1.5% | White-label widget; partner pays you per conversion. |
| **Premium tier** (analytics, multi-wallet, alerts) | $3–10 / mo | Supabase subscriptions + Stripe. |

WinterWallet is structured so each of these can drop in as a separate card
on the dashboard without disturbing the transfer-commission core. **Start
with transfer fees + on-ramp partnerships** — those have the fastest path
from zero users to first dollar.

## Compliance and tax

You are operating a non-custodial wallet that takes a service fee. In most
jurisdictions this is **software / SaaS revenue**, not money transmission,
because you never custody user funds. But this depends on the country.
Concrete pointers:

- **United States**: FinCEN's 2019 guidance generally exempts non-custodial
  software providers from MSB registration, but states (NY's BitLicense,
  for example) may differ.
- **EU**: MiCA exempts truly self-custodial wallet software (Recital 22)
  but watch for "wallet provider" definitions if you ever custody keys.
- **Argentina** (your locale based on the legacy code's ARS strings): the
  CNV's PSAV registry now applies to crypto service providers; a non-custodial
  wallet that takes a fee is in scope. Speak to a local accountant before
  withdrawing material amounts.

Treat fee withdrawals as **income**: the moment `withdraw()` lands on your
wallet, that's a realized event for accounting purposes in most regimes.

## Setup checklist for first revenue

1. Deploy `FeeRouter.sol` to Sepolia ([`contracts/README.md`](../contracts/README.md)).
2. Send a few test transfers through the UI to confirm the fee accumulates.
3. Call `withdraw(0x0000…0000)` from the owner address. Confirm you receive
   it.
4. Deploy to mainnet (Ethereum or Polygon; Polygon is cheaper to test).
5. Set the `VITE_FEE_ROUTER_*` env vars in Cloudflare Pages → redeploy.
6. Open the page on your iPhone, install to home screen, share with your
   first ten users.

That's it. Anything beyond this is growth.

## Transparency obligation

Charging a fee that users don't see is fraud in most jurisdictions and a
brand-killer everywhere else. The Send confirmation in this codebase
**always shows**:

- The fee in bps and the absolute amount.
- The amount the recipient will actually receive.
- The fee recipient address.

Don't change that. Your only sustainable moat is users trusting that what
the UI says is what the contract does.
