# Architecture

WinterWallet is a static, dependency-free frontend that talks directly to
EVM-family blockchains via JSON-RPC. Optionally, it talks to Supabase for
persisted, RLS-protected history.

```
                       ┌──────────────────────────────────────────┐
                       │              Browser (client)            │
                       │                                          │
   ┌─────────────┐     │  ┌──────────────┐     ┌───────────────┐  │
   │ User wallet │◄───►│  │  wallet.js   │     │   ui.js       │  │
   │  (MetaMask) │     │  │  (signer)    │     │   modals/etc. │  │
   └─────────────┘     │  └──────┬───────┘     └───────┬───────┘  │
                       │         │                     │          │
                       │  ┌──────▼─────────────────────▼───────┐  │
                       │  │  app.js (dashboard wiring)         │  │
                       │  │  login.js (connect screen)         │  │
                       │  └──────┬─────────────┬─────────┬─────┘  │
                       │         │             │         │        │
                       │   ethers│RPC          │SIWE     │Supabase│
                       │         │             │POST     │JS SDK  │
                       └─────────┼─────────────┼─────────┼────────┘
                                 │             │         │
                       ┌─────────▼───┐  ┌──────▼────┐ ┌──▼─────────┐
                       │  EVM RPC    │  │ Edge Func │ │ Postgres   │
                       │ (Sepolia,   │  │ siwe-     │ │ (RLS on    │
                       │  Polygon,   │  │ verify    │ │  every     │
                       │  mainnets)  │  │           │ │  table)    │
                       └─────────────┘  └───────────┘ └────────────┘
```

## Modules

### `js/wallet.js`

Single source of truth for "who is the active signer".

- Two backends: **injected** (EIP-1193, MetaMask et al.) and **local**
  (in-browser `ethers.HDNodeWallet` decrypted from a PBKDF2 envelope).
- Exposes a uniform API: `getSigner()`, `getProvider()`, `sendNative()`,
  `estimateNative()`, `getNativeBalance()`, `signMessage()`,
  `switchChain()`.
- Emits `unlocked`, `accountChanged`, `chainChanged`, `logout` events that
  `app.js` listens to.
- Persists only **public**, non-sensitive metadata to `localStorage`
  (active mode, cached address). The encrypted mnemonic envelope is the only
  piece of cryptographic material at rest, and it is unrecoverable without
  the user's password.

### `js/crypto.js`

Password-based encryption layer.

- `encryptString(plaintext, password)` → JSON envelope with `salt`, `iv`,
  ciphertext, KDF parameters.
- `decryptString(envelope, password)` → throws `Incorrect password.` on AES-GCM
  authentication failure.
- Algorithm: PBKDF2-HMAC-SHA256, 210 000 iterations, 16-byte salt → AES-GCM
  256-bit, 12-byte IV.

### `js/network.js`

Chain registry. Each chain entry carries its `chainId`, hex form,
display name, native symbol, block-explorer base URL, faucet links, the
`isTestnet` flag, and a per-chain token table (USDC for now). The active
chain is persisted in `localStorage` under `ww:chainId`.

### `js/erc20.js`

Minimal ERC-20 client (read & write) using ethers.js Contract bindings. The
ABI contains only the four functions needed: `name`, `symbol`, `decimals`,
`balanceOf`, `transfer`.

### `js/siwe.js`

EIP-4361 message builder. We deliberately do not depend on the `siwe`
package — the message format is small, and the only verification happens
server-side.

### `js/supabase.js`

Lazy Supabase client. Exposes `recordTransaction`, `listTransactions`,
`addContact`, `listContacts`, `siweLogin`, `siweLogout`. All writes go to
tables protected by RLS — see [`RLS.md`](RLS.md).

### `js/prices.js`

CoinGecko `/simple/price` consumer with a 60-second in-memory cache and
serve-stale-on-error fallback.

### `js/ui.js`

Tiny DOM helpers: `$`/`$$`, toast, modal `confirmDialog`, `copy`,
`shortAddress`, `escapeHtml`, busy-button decorator, number formatter.

## Backend (optional)

### `supabase/schema.sql`

Three tables — `profiles`, `transactions`, `address_book` — plus a helper
function `public.current_wallet()` that pulls the wallet from the JWT and
lowercases it. RLS policies on every table compare each row's
`wallet_address` against `current_wallet()`. See [`RLS.md`](RLS.md).

### `supabase/functions/siwe-verify`

A Deno Edge Function. Verifies the SIWE signature with
`ethers.verifyMessage`, upserts an auth user that carries `wallet_address`
in `app_metadata` (so it is signed into every JWT), and returns access /
refresh tokens for that user.

## Data flow

### Sending a transaction

1. User submits `{ to, amount, asset }` from the Send card.
2. `app.js` calls `wallet.sendNative()` or `erc20.sendToken()`.
3. ethers signs:
   - injected mode → wallet extension prompts the user;
   - local mode → the in-memory `ethers.Wallet` signs immediately.
4. Tx is broadcast via JSON-RPC; we receive a hash.
5. (Optional) `supabase.recordTransaction()` inserts a row with
   `status='pending'`. RLS allows the insert because the row's
   `wallet_address` matches the JWT claim.
6. `tx.wait()` resolves with a receipt. We update the row to
   `confirmed`/`reverted` and refresh the UI.

### Authentication (SIWE)

1. User clicks "Sign message" — handled in `supabase.siweLogin()`.
2. We build an EIP-4361 message in `siwe.js` and ask the wallet to sign it.
3. We POST the message + signature to the `siwe-verify` Edge Function.
4. The function verifies with `ethers.verifyMessage`, upserts the auth user,
   issues a magic-link OTP server-side, exchanges it for an access token, and
   returns `{ access_token, refresh_token, expires_at }`.
5. The browser sets that session into its Supabase client. Subsequent reads
   and writes carry `auth.jwt()->>'wallet_address'`, which RLS uses to gate
   every row.

## Why static + ESM CDN?

- **Easy hosting.** GitHub Pages, Netlify, Cloudflare Pages — no build, no
  Node runtime needed.
- **Auditable.** Every file in this repo is the file the browser executes.
  No bundler magic.
- **Small attack surface.** The only third-party script tags load
  `ethers@6` and `@supabase/supabase-js@2` from `esm.sh` (`pinned versions`).
  See [`SECURITY.md`](SECURITY.md) for hardening tips
  (subresource integrity, self-hosting the libs).
