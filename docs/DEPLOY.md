# Deploy to Cloudflare Pages

A complete walkthrough from a fresh clone to a live URL you can open on
your iPhone. Time required: ~20 minutes for the first run, ~30 seconds for
every subsequent push.

## Prerequisites

- A GitHub account that owns this repo (you already have it).
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up).
- A free [Supabase project](https://supabase.com/dashboard) — for accounts
  and RLS-protected history. You can defer this and ship the wallet in
  "demo mode" first.
- A free [WalletConnect Cloud project ID](https://cloud.reown.com/) — needed
  for any wallet picker beyond MetaMask.

## 1. Set up Supabase (5 minutes, optional but recommended)

1. New project on supabase.com → pick a region close to your users.
2. Open the **SQL editor** and paste the contents of
   [`supabase/schema.sql`](../supabase/schema.sql). Run it. Confirm with:
   ```sql
   select tablename, rowsecurity from pg_tables
    where schemaname='public'
      and tablename in ('profiles','wallets','transactions','commissions');
   -- All four rows must show rowsecurity = true.
   ```
3. **Settings → Auth → URL Configuration**:
   - **Site URL**: `https://<your-project>.pages.dev` (you'll fill the real
     URL after step 3).
   - **Redirect URLs**: add `https://<your-project>.pages.dev/auth/callback`
     and `https://<your-project>.pages.dev/auth/reset`.
4. **Settings → Auth → Email**: enable "Confirm email". The default
   templates work; brand them later.
5. (Optional) Deploy the SIWE-verify Edge Function for wallet-only sign-in:
   ```bash
   supabase login
   supabase link --project-ref <your-ref>
   supabase secrets set ALLOWED_ORIGIN="https://<your-project>.pages.dev"
   supabase secrets set ALLOWED_DOMAIN="<your-project>.pages.dev"
   supabase functions deploy siwe-verify --no-verify-jwt
   ```

Note the **Project URL** and **anon key** from Settings → API. You'll need
them in step 3.

## 2. Connect Cloudflare Pages to GitHub (3 minutes)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorize Cloudflare to read your repo. Pick this repo
   (`MatiMontenegro/WinterWallet`).
3. Configure build:
   - **Production branch**: `main` (or whichever you treat as production)
   - **Framework preset**: *None* (we use a custom command)
   - **Build command**: `pnpm install --frozen-lockfile && pnpm build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
   - **Environment variables** — add all the `VITE_*` values you have. At
     minimum:
     ```
     VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJ...
     VITE_WALLETCONNECT_PROJECT_ID=...
     VITE_DEFAULT_CHAIN_ID=11155111
     VITE_FEE_BPS=30
     VITE_APP_NAME=WinterWallet
     VITE_APP_URL=https://winterwallet.pages.dev
     ```
4. Save and deploy. ~2 minutes later Cloudflare gives you a URL like
   `https://winterwallet.pages.dev`. Go back to Supabase → Auth → URL
   Configuration and replace the placeholder with this real URL.

## 3. (Alternative) Deploy via GitHub Actions

If you'd rather have CI build/deploy on every push and run PR previews:

1. Cloudflare → **My Profile → API Tokens → Create Token**. Use the
   "Edit Cloudflare Workers" template, scope it to your Pages project.
   Copy the token.
2. Cloudflare → **Workers & Pages → Account ID** (right sidebar). Copy it.
3. GitHub → repo → **Settings → Secrets and variables → Actions**. Add the
   following:
   - **Secrets** (sensitive):
     - `CLOUDFLARE_API_TOKEN`
     - `CLOUDFLARE_ACCOUNT_ID`
     - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SIWE_VERIFY_URL`
     - `VITE_WALLETCONNECT_PROJECT_ID`
     - Any `VITE_RPC_*` keys
   - **Variables** (non-sensitive):
     - `CLOUDFLARE_PROJECT_NAME` (e.g. `winterwallet`)
     - `VITE_DEFAULT_CHAIN_ID`
     - `VITE_FEE_BPS`
     - `VITE_FEE_ROUTER_*` per chain (set these *after* you deploy the
       FeeRouter contract — see step 4)
     - `VITE_APP_NAME`, `VITE_APP_URL`
4. Push to `main`. The workflow in
   [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) builds
   and deploys.

## 4. Deploy the FeeRouter contract (when you're ready to earn)

See [`contracts/README.md`](../contracts/README.md) for the 5-minute Remix
walkthrough. Once deployed:

- Add the address to `VITE_FEE_ROUTER_<chain>` (env var or GitHub variable).
- Redeploy (push, or hit "Retry deployment" in Cloudflare).
- The Send card now routes through the contract and shows the fee in the
  confirmation dialog.

## 5. (Optional) Custom domain

Cloudflare → Pages project → **Custom domains → Set up a custom domain**.
If the domain is on Cloudflare already, it's two clicks. If not, you add
two CNAME records at your registrar.

Remember to update:
- `VITE_APP_URL` in env
- Supabase → Auth → Site URL + Redirect URLs

## Verify after deploy

```bash
# 1. Page loads
curl -I https://winterwallet.pages.dev/
# Expect: HTTP/2 200, content-security-policy header present.

# 2. RLS denies anonymous reads of transactions
curl -s "$SUPABASE_URL/rest/v1/transactions?select=*" \
     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# Expect: [] (empty array — RLS blocks the read).

# 3. PWA manifest is valid
curl -s https://winterwallet.pages.dev/manifest.webmanifest | jq .
# Expect: real JSON with name, icons, etc.
```

Now [install it on your iPhone](PWA-INSTALL.md).
