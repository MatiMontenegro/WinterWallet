# Security model

Read this before holding meaningful value in a wallet you deployed
yourself.

## TL;DR

- **Non-custodial.** Private keys live in the user's wallet (MetaMask,
  Rabby, Coinbase, Trust, Ledger via WalletConnect, etc.). Our domain
  never sees them.
- **Auth is independent of custody.** Supabase email/password (or magic
  link) authenticates the *user account*; the wallet is then connected on
  top. Compromising the email account does not unlock crypto — and vice
  versa.
- **Default network is Sepolia testnet.** Mainnet is one click away but
  the confirmation dialog is explicit.
- **Backend is RLS-locked.** Every persisted row is gated by
  `auth.uid()` policies in Postgres. A leaked anon key reads nothing.
- **Commission contract is hard-capped.** The FeeRouter cannot charge more
  than 1% (encoded as an immutable `MAX_FEE_BPS = 100`). The deployed
  rate is also visible on any block explorer.

## Custody

WinterWallet is non-custodial:

- *Browser-extension wallets* (MetaMask, Rabby, Brave, Frame): keys never
  leave the extension. Every tx pops up there for explicit confirmation.
- *WalletConnect* (mobile wallets, Ledger Live): keys never leave the
  mobile/hardware device. We send the tx-to-sign payload through
  WalletConnect's relay; the user approves on their device.

We have removed the in-browser HD-wallet mode from the previous static
build because **the React app no longer needs it** and because a single
audited extension wallet is materially safer for end users.

## Authentication vs. authorization

Two distinct concerns, deliberately separated:

| Concern | Who controls it | Compromise impact |
| --- | --- | --- |
| Account access | Supabase Auth (email/password or magic link) | Attacker can see your tx history, address book; cannot move funds |
| Funds | Your connected wallet (MetaMask, hardware, etc.) | Attacker can sign transactions; cannot read RLS rows without the email account |

This split is intentional: even if Supabase is fully compromised, no
crypto moves. Even if a phishing wallet is connected, your account data
stays gated by the email-side session.

## Cryptography choices

We rely on:

- **Supabase Auth**: PBKDF2-based password hashing, JWT signing with the
  project's secret. We do not roll our own — Supabase handles it.
- **Web Crypto** (browser-native): used for all randomness (e.g. SIWE
  nonces).
- **viem**: EIP-1193 signing pipeline, RLP encoding, ECDSA recovery for
  SIWE verification (used inside the Edge Function).
- **FeeRouter contract**: reentrancy-guarded, immutable max-fee constant,
  two-step owner transfer.

## What a malicious or compromised host can and cannot do

If the static files are tampered with — for example, an attacker replaces
`SendCard.tsx` to silently change the recipient — the user is at risk.
**Mitigations the codebase already applies**:

1. **CSP**: `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`,
   `frame-ancestors 'none'`. No third-party scripts are loaded at
   runtime. The signed bundle is the entire attack surface.
2. **HSTS + immutable asset caching** with content hashes — once a
   browser has visited, a downgrade attack cannot serve plaintext.
3. **External wallet UX**: even with a hostile dApp, MetaMask/Ledger
   shows the destination address before signing. Users who read the
   dialog cannot be silently rerouted.

Mitigations **you should add when self-hosting**:

- Pin your dependencies (`pnpm-lock.yaml` is committed).
- Enable [Cloudflare Pages branch protection](https://developers.cloudflare.com/pages/configuration/branch-deployments/)
  to require human review before main deploys.
- Set up [Sigstore](https://www.sigstore.dev/)-signed release builds
  if you go past a few thousand users.

## Supabase RLS

The anon key shipped to the browser is a public token. If RLS is
disabled it grants read/write to every row. **Our schema enables RLS on
every table** and only allows reads/writes that match `auth.uid()`.

See [`RLS.md`](RLS.md) for every policy and a recipe to confirm a stolen
anon key reads nothing.

## SIWE replay protection

The `siwe-verify` Edge Function rejects messages that:

- Have an `Issued At` older than 10 minutes or in the future (with 1-min
  clock skew allowance).
- Don't match the configured `ALLOWED_DOMAIN`.
- Disagree on `chainId`.
- Don't recover to the claimed address.

Nonce reuse is **not** persisted in this MVP. If your threat model requires
strict single-use, add a `nonces` table with `(nonce, used_at)` and
`INSERT … ON CONFLICT DO NOTHING` before issuing the session.

## FeeRouter contract

The on-chain commission contract:

- `MAX_FEE_BPS` is a `constant` baked into the bytecode. Owner cannot
  change it. Anyone can verify this on a block explorer.
- `setFeeBps(uint16)` reverts if `> MAX_FEE_BPS`.
- Both `sendNative` and `sendToken` use a transient reentrancy lock.
- Ownership transfer is two-step: `proposeOwner` + `acceptOwner`. A
  fat-finger transfer cannot lock you out.
- `withdraw` is owner-only.

Audit status: **not** independently audited. Read the ~150-line source
(`contracts/FeeRouter.sol`) and test it thoroughly on a testnet before
deploying to mainnet at scale.

## Reporting a vulnerability

Open a **private security advisory** on GitHub for this repo rather than
a public issue. We'll acknowledge within 72 hours.
