# Architecture

WinterWallet is a Vite-bundled React SPA, signed and sealed at build time,
deployed to Cloudflare Pages. The frontend talks directly to EVM chains
via JSON-RPC (through viem/wagmi) and to Supabase for persisted data.

```
                ┌────────────────────────────────────────────────────┐
                │       Browser  ·  Safari iPhone (PWA)              │
                │  ┌─────────────────────────────────────────────┐   │
                │  │           React 19 + Vite SPA               │   │
                │  │                                             │   │
                │  │  RainbowKit ──► wagmi ──► viem ──► JSON-RPC │   │
                │  │       │                                     │   │
                │  │       ▼                                     │   │
                │  │  user wallet (MetaMask / WalletConnect)     │   │
                │  │                                             │   │
                │  │  Supabase JS SDK ──► PostgREST / Auth       │   │
                │  └─────────────────────────────────────────────┘   │
                └───────────┬───────────────────┬─────────────────┬──┘
                            │JSON-RPC           │HTTPS            │HTTPS
                ┌───────────▼─────┐   ┌─────────▼─────────┐  ┌───▼──────────┐
                │  EVM chain RPC  │   │   Supabase Auth   │  │  CoinGecko   │
                │  (Sepolia,      │   │   + Postgres RLS  │  │  (prices)    │
                │   Polygon, …)   │   │                   │  │              │
                └─────────────────┘   └─────────┬─────────┘  └──────────────┘
                                                │
                            ┌───────────────────▼──────────────┐
                            │ Edge Function: siwe-verify (Deno)│
                            │ verifies EIP-4361 → mints session│
                            └──────────────────────────────────┘

                ┌─────────────────────────────────────────────────┐
                │           On-chain (FeeRouter.sol)              │
                │   sendNative(to)  /  sendToken(token,to,amount) │
                │   ── splits user amount: (1-feeBps) → recipient │
                │                          feeBps         → owner │
                └─────────────────────────────────────────────────┘
```

## Module map

### `src/lib`

- **`wagmi.ts`** — RainbowKit's `getDefaultConfig` wired with our chain list
  and optional custom RPC URLs.
- **`chains.ts`** — per-chain metadata (display name, USDC address, faucet
  URLs, fee-router lookup). The single place to add a new EVM chain.
- **`feeRouter.ts`** — ABI + `quoteNative` / `quoteErc20` (compute fee &
  recipient amount in BigInts). Used by SendCard.
- **`supabase.ts`** — singleton Supabase client, typed table row shapes.
- **`siwe.ts`** — EIP-4361 message builder + `exchangeSiwe` (POST to the
  Edge Function, install the returned session).
- **`prices.ts`** — CoinGecko `/simple/price` with a 60-s in-memory cache.
- **`utils.ts`** — `cn`, `shortAddress`, `fmtNumber`, `fmtUsd`, iOS detection,
  standalone-mode detection.
- **`env.ts`** — runtime-typed VITE_* env accessor with safe defaults.

### `src/hooks`

- **`useAuth.ts`** — exposes Supabase session via `useSyncExternalStore`,
  so any component can react to sign-in / sign-out.
- **`useTokenBalance.ts`** — wagmi `useReadContract` on `balanceOf`,
  polled every 15 s.
- **`useTransactionHistory.ts`** — TanStack Query against the
  RLS-protected `transactions` table.

### `src/components`

- **`AuthShell.tsx`** — gradient background, animated logo, header used
  by every auth screen.
- **`Button.tsx` / `Field.tsx` / `Modal.tsx` / `Toast.tsx`** — minimal,
  framework-free primitives.
- **`TopBar.tsx`** — sticky header with RainbowKit connect button + sign-out.
- **`BalanceCard.tsx`** — total USD, native + USDC tiles, copy address,
  testnet/mainnet banner.
- **`SendCard.tsx`** — the send form. Routes through FeeRouter when one is
  configured for the active chain; otherwise direct transfer. Inserts a
  pending row into Supabase, watches the receipt, updates status.
- **`HistoryCard.tsx`** — pulls from Supabase, surfaces fees if any.
- **`InstallPrompt.tsx`** — iOS-only banner pointing at the Share-Sheet
  install step. Self-dismissing, 7-day cooldown.

### `src/routes`

- **`Login.tsx`** — email + password OR magic link, animated background.
- **`Signup.tsx`** — email + password + display-name with live strength meter.
- **`ForgotPassword.tsx`** — Supabase reset flow.
- **`AuthCallback.tsx`** — handles email confirmation / magic-link /
  password-reset redirects.
- **`Dashboard.tsx`** — the wallet panel itself.

### `contracts/FeeRouter.sol`

A ~150-line, owner-administered Solidity contract that splits incoming
transfers between the recipient and the operator (you), with the fee rate
hard-capped at 1% in the bytecode. See [`MONETIZATION.md`](MONETIZATION.md)
and [`contracts/README.md`](../contracts/README.md).

### `supabase/`

- **`schema.sql`** — four tables (`profiles`, `wallets`, `transactions`,
  `commissions`) with RLS enabled on every one. See [`RLS.md`](RLS.md).
- **`functions/siwe-verify/index.ts`** — Deno Edge Function: parses an
  EIP-4361 message, verifies the signature, upserts an auth user, returns
  a session.

## Data flow: a send transaction

```
 user fills SendCard
        │
        ▼
 Quote = (amount * feeBps) / 10000        ←── feeRouter.quote*
        │
        ▼
 Modal shows:  recipient gets X, fee Y, network Z
        │
        ▼  user clicks "Send"
        │
        ▼
 wagmi.useWriteContract / useSendTransaction
   ├─ native: sendTx(to=router, value=total, data=sendNative(recipient))
   └─ erc20:  approve(router, total) → router.sendToken(token, recipient, total)
        │
        ▼
 RainbowKit-connected wallet signs and broadcasts
        │
        ▼
 We get a tx hash → insert pending row into transactions  (RLS: user_id = auth.uid())
        │
        ▼
 viem.publicClient.waitForTransactionReceipt(hash)
        │
        ▼
 Update row to confirmed/reverted + receipt fields
        │
        ▼
 TanStack Query refetches → HistoryCard re-renders
```

## Build pipeline

```
GitHub push
     │
     ▼
GitHub Actions (deploy.yml) — optional path
  ├─ pnpm install --frozen-lockfile
  ├─ pnpm typecheck                  ←── catches typos before they ship
  ├─ pnpm generate-pwa-assets        ←── PNGs from icon.svg
  ├─ pnpm build  (tsc → vite)        ←── per-locale code-split, sourcemaps
  └─ wrangler pages deploy dist
     │
     ▼
Cloudflare Pages — global CDN
  ├─ _headers   → CSP, HSTS, X-Frame-Options, immutable cache for /assets
  ├─ _redirects → SPA fallback (* → /index.html)
  └─ /sw.js     → Workbox precache (5 MB shell), runtime cache for CoinGecko
```

## Why a service worker on a wallet?

Three concrete wins:

1. **Cold-start latency.** After the first install the shell is local; the
   wallet opens in ~100 ms even on cellular.
2. **PWA installability.** iOS requires a registered service worker for
   `Add to Home Screen` to behave as a standalone app.
3. **Resilience.** If a CDN edge has a hiccup, the app loads from cache
   and just shows a "reconnecting…" balance.

What it deliberately does **not** cache: signed transactions, RPC reads,
Supabase responses. Anything that must reflect real on-chain state is
network-only.
