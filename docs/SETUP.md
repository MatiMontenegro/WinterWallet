# Setup

End-to-end: from cloning the repo to having a working wallet with
RLS-protected history.

## 1. Frontend (no backend, ~2 min)

```bash
git clone <this repo>
cd WinterWallet
cp config.example.js config.js   # optional — needed only for custom RPCs / Supabase
```

Serve the directory with anything that speaks HTTP:

```bash
npx http-server -c-1 .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080/login.html`. You can already create a wallet
and send Sepolia transactions. Skip the rest of this document if that's all
you need.

## 2. Custom RPC (recommended for production)

The default RPCs (`*.publicnode.com`) are public and rate-limited. For any
real deployment, use Alchemy / Infura / QuickNode or your own node.

In `config.js`:

```js
window.WW_CONFIG = {
  rpc: {
    11155111: "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
    1:        "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
    80002:    "https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY",
    137:      "https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY",
  },
  defaultChainId: 11155111,
};
```

Restricting your Alchemy / Infura key to your domain prevents anyone who
copies it out of your bundle from burning your quota.

## 3. Supabase backend (RLS-protected history)

Prerequisites: a Supabase project and the
[Supabase CLI](https://supabase.com/docs/guides/cli).

### 3.1 Apply the schema

Open the **SQL editor** in your Supabase dashboard and paste the contents of
[`supabase/schema.sql`](../supabase/schema.sql), or run from the CLI:

```bash
supabase login
supabase link --project-ref <your-ref>
supabase db push --include-all
```

Confirm RLS is on:

```sql
select tablename, rowsecurity from pg_tables
 where schemaname='public' and tablename in
       ('profiles','transactions','address_book');
-- All three rows should show rowsecurity = true.
```

### 3.2 Deploy the SIWE-verify Edge Function

```bash
# Required — match what you'll serve the site from. "*" works for testing
# but should be a specific origin in production.
supabase secrets set ALLOWED_ORIGIN="https://yourapp.example"

# Required — the EIP-4361 `domain` field the function should accept.
# Must equal `window.location.host` of the frontend.
supabase secrets set ALLOWED_DOMAIN="yourapp.example"

# Deploy. --no-verify-jwt allows anonymous users to call /siwe-verify
# (they have to, that's the login).
supabase functions deploy siwe-verify --no-verify-jwt
```

The function URL will look like:

```
https://<project-ref>.supabase.co/functions/v1/siwe-verify
```

### 3.3 Wire the frontend

Edit `config.js`:

```js
window.WW_CONFIG = {
  // ... rpc and defaultChainId ...
  supabase: {
    url:           "https://<project-ref>.supabase.co",
    anonKey:       "eyJhbGciOiJIUzI1NiIs...",   // anon (public) key
    siweEndpoint:  "https://<project-ref>.supabase.co/functions/v1/siwe-verify",
  },
};
```

Reload the app. After connecting a wallet you'll be prompted to **sign a
message** — that's the SIWE handshake. Accept it and the Transactions card
will say "Supabase (RLS-protected)".

### 3.4 Verify RLS works

In a fresh incognito window with **only the anon key** (no JWT):

```bash
curl -s "$SUPABASE_URL/rest/v1/transactions?select=*" \
     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# Expected: []   (no rows leak)
```

See [`RLS.md`](RLS.md) for the cross-wallet test.

## 4. Hosting

Anywhere that serves static files works:

- **GitHub Pages**: push to `gh-pages` or enable Pages on `main`.
- **Cloudflare Pages**: point at the repo, build command empty, output
  directory `/`.
- **Netlify**: same.
- **S3 + CloudFront**: upload, set index.html as the default doc.

Add a `_headers` file (Netlify / Cloudflare) or equivalent for CSP — see
[`SECURITY.md`](SECURITY.md) for a recommended policy.

## 5. Production checklist

- [ ] `config.js` is **not** in git (it is in `.gitignore`).
- [ ] Custom RPC keys configured.
- [ ] `ALLOWED_DOMAIN` matches the actual host serving the site.
- [ ] HTTPS + HSTS in front of every page.
- [ ] `Content-Security-Policy` header in place.
- [ ] Subresource Integrity hashes added to the two `esm.sh` script tags
      (or self-host `ethers` and `@supabase/supabase-js`).
- [ ] RLS verified by smoke test (anon read returns `[]`).
- [ ] You actually try sending a tiny testnet tx end-to-end before any
      mainnet usage.
