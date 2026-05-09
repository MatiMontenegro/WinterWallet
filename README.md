# WinterWallet

A **real, non-custodial EVM wallet** that runs as a static site. WinterWallet
talks directly to Ethereum-family blockchains over JSON-RPC, signs every
transaction locally, and uses Postgres Row Level Security to keep per-wallet
data isolated.

> **What "real" means.** WinterWallet is not a simulation and does not store
> fake balances. It signs and broadcasts genuine transactions. By default it
> runs on the **Sepolia testnet** so you can experiment without spending real
> money. Mainnet networks are available behind an explicit toggle and an
> in-app confirmation that warns you funds and gas fees are real.

---

## Features

| Capability | How |
| --- | --- |
| Connect MetaMask / Rabby / Brave Wallet | EIP-1193 injected provider |
| Create a fresh wallet in the browser | BIP-39 mnemonic, encrypted with PBKDF2 (210k) + AES-GCM |
| Import an existing 12 / 24-word phrase | Re-encrypted with a local password |
| Send native asset (ETH / MATIC) | Real on-chain transfers, EIP-1559 fees |
| Send ERC-20 (USDC out of the box) | Standard `transfer()` |
| Live gas estimation | `eth_estimateGas` + `eth_feeHistory` |
| Live USD prices | CoinGecko (no API key, 60 s cache) |
| Multi-network: Sepolia, Polygon Amoy, Ethereum mainnet, Polygon mainnet | Built-in chain registry, in-wallet `wallet_switchEthereumChain` |
| Sign-In With Ethereum (EIP-4361) | Supabase Edge Function verifies the signature and mints a session |
| Per-wallet transaction history | Postgres table protected by **real RLS policies** keyed to the JWT's `wallet_address` claim |
| Address book | Same RLS pattern |
| Block explorer deep-links | Per-network |

---

## Quick start (testnet, no backend)

1. Clone the repo and serve it with any static file server. Example:
   ```bash
   npx http-server -c-1 .
   # or: python3 -m http.server 8080
   ```
2. Open `http://localhost:8080/login.html`.
3. Either click **Connect browser wallet** (MetaMask) or use **Create wallet**
   to generate one in-browser. Save the recovery phrase somewhere safe.
4. The default network is **Sepolia**. Use the on-page faucet link to fund
   your address with test ETH, then send it to another address.

That's it — no backend, no database, no build step. The wallet is fully
functional this way; you just won't have persistent transaction history.

## Optional: enable transaction history with Supabase + RLS

See [`docs/SETUP.md`](docs/SETUP.md) for the full walkthrough. Short version:

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor — it
   creates the `profiles`, `transactions`, `address_book` tables and the
   per-wallet RLS policies.
3. Set Edge Function secrets and deploy
   [`supabase/functions/siwe-verify`](supabase/functions/siwe-verify):
   ```bash
   supabase secrets set ALLOWED_DOMAIN=yourapp.example
   supabase functions deploy siwe-verify --no-verify-jwt
   ```
4. Copy `config.example.js` to `config.js`, fill in your Supabase URL, anon
   key, and the function URL.
5. Reload — the UI will prompt you to sign a SIWE message, after which all
   reads/writes are RLS-protected.

---

## Documentation

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — modules and data flow.
- **[`docs/SECURITY.md`](docs/SECURITY.md)** — threat model, key custody,
  cryptography choices, what we do *not* defend against.
- **[`docs/RLS.md`](docs/RLS.md)** — every policy, why it exists, and how to
  test that an attacker with a stolen anon key still cannot read anyone
  else's rows.
- **[`docs/SETUP.md`](docs/SETUP.md)** — end-to-end install (frontend +
  Supabase + RPC providers).
- **[`docs/TESTNET.md`](docs/TESTNET.md)** — how to obtain Sepolia / Amoy
  test funds and execute your first real on-chain send.

---

## Project layout

```
.
├── index.html                          # main wallet dashboard
├── login.html                          # connect / create / import / unlock
├── config.example.js                   # runtime config template (gitignored copy: config.js)
├── css/style.css                       # dark, framework-free design system
├── js/
│   ├── app.js                          # dashboard wiring
│   ├── login.js                        # auth screen wiring
│   ├── wallet.js                       # injected + in-browser wallet abstraction
│   ├── crypto.js                       # PBKDF2 + AES-GCM for mnemonic at rest
│   ├── network.js                      # chain registry (testnets + mainnets)
│   ├── erc20.js                        # ERC-20 read/write helpers
│   ├── prices.js                       # CoinGecko price oracle
│   ├── siwe.js                         # EIP-4361 message builder
│   ├── supabase.js                     # client + RLS-protected data ops
│   ├── ui.js                           # toast, modal, copy, formatting
│   └── config.js                       # config defaults loader
├── supabase/
│   ├── schema.sql                      # tables + RLS policies
│   └── functions/siwe-verify/index.ts  # Deno Edge Function
└── docs/
    ├── ARCHITECTURE.md
    ├── SECURITY.md
    ├── RLS.md
    ├── SETUP.md
    └── TESTNET.md
```

---

## What changed from the previous WinterWallet?

The previous version was a `localStorage`-based demo with fake ARS pesos and a
fake BTC counter that grew with a CoinGecko percentage tick. **None of it
touched a blockchain.** This rewrite replaces it with a real EVM wallet:

- Real key management (BIP-39 + WebCrypto, or external EIP-1193 wallets).
- Real transactions broadcast over JSON-RPC.
- Real on-chain balances.
- Real RLS in Postgres for the optional history backend.
- A modern, accessible dark UI.

If you want to see the legacy demo, it lives in git history before the
`claude/web3-wallet-blockchain-*` branch.

---

## License

MIT. Use at your own risk. This software handles cryptocurrency; review the
[security model](docs/SECURITY.md) before holding meaningful value in a
self-custody wallet.
