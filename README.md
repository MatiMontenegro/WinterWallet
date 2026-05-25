# WinterWallet

A **real, non-custodial EVM wallet** built with the 2026 reference stack
and installable on your iPhone in 20 seconds.

[![Open in Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](docs/DEPLOY.md)
[![PWA](https://img.shields.io/badge/PWA-installable-blue)](docs/PWA-INSTALL.md)

```
┌──────────────────────────────────────────────────────────────────┐
│  React 19 + Vite 6  ·  wagmi v2 + viem v2  ·  RainbowKit v2      │
│  Tailwind v4  ·  TanStack Query  ·  vite-plugin-pwa              │
│  Supabase (Auth · Postgres · RLS · Edge Functions)               │
│  Cloudflare Pages  ·  GitHub Actions  ·  Workbox SW              │
│  FeeRouter Solidity contract (1% hard-capped commission)         │
└──────────────────────────────────────────────────────────────────┘
```

## What this is

- **A real wallet**, not a demo. It signs and broadcasts genuine on-chain
  transactions using user-controlled keys (browser-extension or
  WalletConnect — keys never enter our domain).
- **An iPhone-installable PWA**. Open the URL in Safari, tap *Add to Home
  Screen*, and you have a fullscreen app with its own icon. No App Store,
  no Apple Developer fee, no review.
- **A revenue product.** Optional `FeeRouter` smart contract collects a
  hard-capped (≤1%) commission on every send, in a single user-signed
  transaction. See [`docs/MONETIZATION.md`](docs/MONETIZATION.md) for the
  business model and realistic earning projections.
- **Postgres RLS done right.** Every persisted row is gated by
  `auth.uid()` policies in the database itself — a leaked anon key reads
  nothing.

## Quick start

```bash
pnpm install
cp .env.example .env.local      # then fill in the values you have
pnpm dev                        # → http://localhost:5173
```

The app runs in "demo mode" without Supabase. Connect MetaMask / Rabby /
WalletConnect, switch to **Sepolia** in the picker, fund the address from
[a faucet](https://www.alchemy.com/faucets/ethereum-sepolia), and send a
testnet transaction.

## One-time deployment

The fastest path to a live URL you can open on your iPhone:

1. Push this repo to GitHub.
2. Cloudflare Pages → *Connect to Git* → pick the repo. Build command
   `pnpm install --frozen-lockfile && pnpm build`, output `dist`.
3. Wait ~2 minutes. You now have `https://<project>.pages.dev`.
4. Open that URL in Safari on your iPhone → Share → **Add to Home Screen**.

The complete walkthrough — including Supabase setup, custom domain,
WalletConnect, and the optional GitHub Actions pipeline — is in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Documentation

| Doc | Why you'd read it |
| --- | --- |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Cloudflare Pages + Supabase, end-to-end |
| [`docs/PWA-INSTALL.md`](docs/PWA-INSTALL.md) | Install on iPhone in 20 seconds |
| [`docs/MONETIZATION.md`](docs/MONETIZATION.md) | Commission math, realistic earnings, compliance |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Modules, data flow, build pipeline |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model, key custody, what we don't defend against |
| [`docs/RLS.md`](docs/RLS.md) | Every Postgres policy + verification recipe |
| [`docs/SETUP.md`](docs/SETUP.md) | Local development setup |
| [`docs/TESTNET.md`](docs/TESTNET.md) | First-tx walkthrough, faucets |
| [`contracts/README.md`](contracts/README.md) | Deploying the FeeRouter contract |

## Project layout

```
.
├── index.html                          # Vite entry with iOS PWA meta tags
├── vite.config.ts                      # PWA, Tailwind, chunking, workbox
├── tsconfig.{app,node}.json            # Project references
├── package.json                        # React 19, wagmi 2, viem 2, RainbowKit 2
├── src/
│   ├── main.tsx · App.tsx              # Entry + router/providers
│   ├── env.ts                          # Typed VITE_* env loader
│   ├── lib/
│   │   ├── chains.ts                   # Chain registry + fee-router lookup
│   │   ├── wagmi.ts                    # RainbowKit + wagmi config
│   │   ├── supabase.ts                 # Auth + DB client
│   │   ├── siwe.ts                     # SIWE message builder & exchange
│   │   ├── feeRouter.ts                # ABI + quote helpers
│   │   ├── prices.ts                   # CoinGecko price oracle
│   │   └── utils.ts                    # cn, fmt, iOS detection, etc.
│   ├── hooks/                          # useAuth, useTokenBalance, useTransactionHistory
│   ├── components/                     # AuthShell, Button, Field, Modal, Toast,
│   │                                   #   TopBar, BalanceCard, SendCard,
│   │                                   #   HistoryCard, InstallPrompt
│   └── routes/                         # Login, Signup, ForgotPassword,
│                                       #   AuthCallback, Dashboard
├── contracts/
│   ├── FeeRouter.sol                   # The commission contract
│   └── README.md                       # Deploy + ops guide
├── supabase/
│   ├── schema.sql                      # profiles, wallets, transactions,
│   │                                   #   commissions + RLS policies
│   └── functions/siwe-verify/index.ts  # Deno Edge Function (SIWE → session)
├── public/
│   ├── _headers · _redirects           # Cloudflare Pages (CSP, SPA fallback)
│   ├── icon.svg                        # Source for generated PWA icons
│   ├── pwa-{64,192,512}.png            # Generated by pwa-assets-generator
│   ├── apple-touch-icon-180x180.png    # iOS home-screen icon
│   └── maskable-icon-512x512.png       # Android adaptive icon
├── .github/workflows/deploy.yml        # CI → Cloudflare Pages
├── wrangler.toml                       # Cloudflare project config
└── docs/                               # All long-form docs
```

## Tech choices, justified

- **React 19 + Vite 6**: zero-config dev experience, sub-second HMR,
  tiny prod bundles via per-locale code-splitting.
- **wagmi v2 + viem v2**: the modern, type-safe replacement for ethers.
  Viem is half the bundle size and noticeably faster for the operations
  we care about.
- **RainbowKit v2**: best wallet-connect UX out of the box. Supports
  injected, WalletConnect, Coinbase, Safe, and dozens of mobile wallets.
- **Tailwind v4**: CSS-first config, no `tailwind.config.js`, faster
  build, native `@theme` directive for tokens.
- **TanStack Query**: wagmi uses it internally; we use the same client
  for Supabase reads so cache invalidation stays consistent.
- **vite-plugin-pwa + Workbox**: precaches the shell, serves offline,
  generates iOS-correct icons from one SVG source.
- **Supabase Auth + Postgres**: email/password + magic link + RLS in 30
  lines of SQL. Optional SIWE via the Edge Function.
- **Cloudflare Pages**: free tier covers the realistic launch scale,
  global CDN, instant rollbacks, Workers-style headers via `_headers`.

## License

MIT. Self-custody software handles real money — read
[`docs/SECURITY.md`](docs/SECURITY.md) before holding meaningful value.
