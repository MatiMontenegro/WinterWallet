# Security model

This document is honest about what WinterWallet does and does not protect.
Read it before holding meaningful value.

## TL;DR

- **Best mode:** connect MetaMask (or any EIP-1193 wallet). Keys never enter
  this site. We can never sign without your approval.
- **Second-best mode:** in-browser HD wallet, encrypted at rest with PBKDF2 +
  AES-GCM. Strong as long as your password is strong and your device is not
  compromised.
- **Default network:** Sepolia testnet. Mainnet is gated behind an explicit
  toggle and an in-app confirmation.
- **Backend:** optional. Even when configured, the database enforces
  per-wallet isolation via Row Level Security — see [`RLS.md`](RLS.md).

## Custody

WinterWallet is **non-custodial**. Nobody — not the deployer, not the
backend, not the developers — can move your funds:

- *Injected mode*: your private keys never leave your wallet extension.
- *Local mode*: keys exist only in browser memory after unlock; on disk
  they're an encrypted envelope. The backend never sees them.

We never ask for the recovery phrase after creation, never log it, and never
transmit it.

## Cryptography (in-browser wallet)

| Concern | Choice |
| --- | --- |
| KDF | PBKDF2-HMAC-SHA256 |
| KDF iterations | 210 000 (OWASP 2023 minimum) |
| Salt | 16 random bytes from `crypto.getRandomValues` |
| Cipher | AES-GCM, 256-bit key |
| IV | 12 random bytes per encryption |
| Authentication | Built into AES-GCM (16-byte tag) |
| Wallet derivation | BIP-39 → BIP-44 (`ethers.Wallet.fromPhrase`) |

Wrong password ⇒ AES-GCM authentication failure ⇒ `Incorrect password.`
There is no fallback, no recovery, no support email. Lose the password and
the recovery phrase, and the wallet is gone.

We deliberately do **not** use Argon2 (no native subtle-crypto support yet)
or Web Crypto's `wrapKey` (cross-browser quirks). PBKDF2 with 210k iterations
gives ~250 ms unlock latency on a 2024 laptop, which is the upper bound we
were willing to spend.

## Risk: a malicious or compromised host

If the static files are tampered with — for example, an attacker replaces
`wallet.js` and exfiltrates mnemonics — the in-browser wallet is fully
compromised. **The injected-wallet path is materially safer**: the extension
shows the transaction details before signing, so an injected payload cannot
silently steal funds, only trick the user via what's displayed.

Mitigations you can apply when self-hosting:

1. Serve from a host you control, behind HTTPS, with HSTS.
2. Add a strict `Content-Security-Policy` (see below).
3. Pin `ethers` and `@supabase/supabase-js` by self-hosting them and removing
   the CDN dependency, or use Subresource Integrity (`integrity="sha384-…"`)
   on the script tags.
4. Audit every commit before publishing.

### Suggested CSP

```
Content-Security-Policy: default-src 'self';
  script-src 'self' https://esm.sh;
  style-src  'self' https://fonts.googleapis.com 'unsafe-inline';
  font-src   'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.publicnode.com https://*.alchemy.com
              https://*.infura.io https://api.coingecko.com
              https://*.supabase.co;
  img-src 'self' data:;
  frame-ancestors 'none';
  base-uri 'self';
```

Tighten `connect-src` to the exact RPC, price, and Supabase endpoints you
configure.

## Risk: a malicious RPC provider

A hostile RPC can lie about balances, censor your transactions, or deny
service. It cannot sign without your key. Use a provider you trust
(Alchemy, Infura, your own node). Never reuse the same key for high-value
operations behind an RPC you do not trust.

## Risk: a stolen Supabase anon key

The Supabase anon key is a public token shipped to every browser. If RLS is
disabled, a stolen anon key grants read/write access to every row in every
table. **Our schema enables RLS on every table and only allows reads/writes
that match the JWT's `wallet_address` claim.** Rotating the anon key buys
nothing — assume it leaks; rely on RLS instead.

See [`RLS.md`](RLS.md) for the policy-by-policy walk-through and a test
recipe to confirm a stolen anon key can read nothing.

## Risk: SIWE replay

The Edge Function checks:

- `Issued At` is within the last 10 minutes;
- `Issued At` is not in the future (with a 1-minute clock-skew tolerance);
- the `domain` matches `ALLOWED_DOMAIN` (set as a function secret);
- the `chainId` in the message equals the claimed `chainId`;
- the recovered signer equals the claimed `address`.

Replays of an old message are rejected by the time check. Cross-domain
replays are rejected by `domain`. The function does not yet persist nonces;
add a `nonces` table with `(nonce, used_at)` and reject duplicates if your
threat model demands strict single-use messages.

## Risk: phishing / fake site

Self-custody wallets are routinely lost to lookalike domains. Always
double-check the URL before signing anything. The Send dialog spells out
the destination, asset, and network — never approve if any line surprises
you.

## What's intentionally out of scope

- **Hardware wallets.** Use the injected mode with MetaMask + Ledger/Trezor
  if you want hardware-backed keys.
- **WalletConnect v2.** A `walletConnectProjectId` slot exists in
  `config.example.js` but the integration is not wired in this version.
- **Token allowance management.** This is a transfer-only wallet; it does not
  call `approve()` or interact with DEX routers.
- **NFTs.** ERC-721 / ERC-1155 are not displayed.
- **Mobile in-app browsers** are best-effort; the UI is responsive but the
  unique constraints of in-app webviews (no extensions) are not covered.

## Reporting

If you find a vulnerability, please open a private security advisory on
GitHub rather than a public issue.
