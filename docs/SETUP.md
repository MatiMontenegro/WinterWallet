# Local development setup

For deploying to production see [`DEPLOY.md`](DEPLOY.md). This document is
about running the wallet on your laptop while you change code.

## Prerequisites

- **Node 22+**, **pnpm 10+** (or any compatible package manager).
- A browser with MetaMask, Rabby, or any EIP-1193 wallet installed.
- *(Optional)* A Supabase project for accounts and RLS.
- *(Optional)* A WalletConnect Cloud project ID for mobile-wallet support.

## 1. Install + run

```bash
git clone <your fork>
cd WinterWallet
pnpm install
cp .env.example .env.local        # then edit
pnpm dev                          # → http://localhost:5173
```

The app boots in **demo mode** (no Supabase). You can still connect a
wallet, switch to Sepolia, and send testnet transactions — only the
persisted history is disabled.

## 2. Connect a Supabase project

1. Create a free project at <https://supabase.com>.
2. SQL editor → paste [`supabase/schema.sql`](../supabase/schema.sql) →
   Run.
3. Verify RLS:
   ```sql
   select tablename, rowsecurity from pg_tables
    where schemaname='public'
      and tablename in ('profiles','wallets','transactions','commissions');
   -- All four must show rowsecurity = true.
   ```
4. Settings → API → copy **URL** and **anon key** into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs…
   ```
5. Settings → Auth → URL Configuration:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/auth/callback`,
     `http://localhost:5173/auth/reset`
6. (Optional) Edit the email templates under Auth → Templates to brand
   the confirmation email.

Restart `pnpm dev`. The demo-mode badge in the corner disappears; the
Login / Signup screens are now functional.

## 3. Connect a WalletConnect project

Required for any wallet picker beyond browser extensions.

1. Sign up at <https://cloud.reown.com> (WalletConnect's umbrella).
2. Create a project; copy the **Project ID**.
3. Add it to `.env.local`:
   ```
   VITE_WALLETCONNECT_PROJECT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## 4. Custom RPC (recommended)

The default RPCs (`*.publicnode.com`) are rate-limited. For development
quality of life:

```
VITE_RPC_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_MAINNET=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_POLYGON_AMOY=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
```

Alchemy's free tier is more than enough for local dev.

## 5. Deploy the FeeRouter (optional)

Skip this if you're not collecting commissions yet. When you're ready:
[`contracts/README.md`](../contracts/README.md). After deploying, add:

```
VITE_FEE_ROUTER_SEPOLIA=0x…
VITE_FEE_BPS=30
```

The Send card will now show the fee disclosure and route transfers
through the contract.

## 6. Deploy the SIWE Edge Function (optional)

Adds Sign-In With Ethereum as an alternative to email login.

```bash
supabase login
supabase link --project-ref <ref>
supabase secrets set ALLOWED_ORIGIN="http://localhost:5173"
supabase secrets set ALLOWED_DOMAIN="localhost:5173"
supabase functions deploy siwe-verify --no-verify-jwt
```

Set the URL in `.env.local`:

```
VITE_SIWE_VERIFY_URL=https://<ref>.supabase.co/functions/v1/siwe-verify
```

## Useful scripts

```bash
pnpm dev                  # Vite dev server, HMR
pnpm typecheck            # tsc --noEmit
pnpm build                # tsc -b && vite build  (produces dist/)
pnpm preview              # serve the production build locally
pnpm generate-pwa-assets  # regenerate PWA icons from public/icon.svg
pnpm deploy               # wrangler pages deploy dist (after login)
```

## Common pitfalls

**"Cannot find module '@/foo'"** — TS path aliases require the file to
live under `src/`; check `tsconfig.app.json` if you're adding new
top-level folders.

**"Module not found: tailwindcss"** — Tailwind v4 ships its plugin
separately. `vite.config.ts` already imports `@tailwindcss/vite`; just
keep `@import "tailwindcss"` at the top of `src/index.css`.

**RainbowKit modal looks unstyled** — make sure `index.css` imports
`@rainbow-me/rainbowkit/styles.css` (it does in our setup).

**"Supabase email confirmation link goes to localhost"** — that's the
Site URL in Supabase Auth settings. Update it for production.
