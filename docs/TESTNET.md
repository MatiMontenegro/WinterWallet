# Testnet walkthrough

A complete first-transaction recipe with no risk to real funds.

## 1. Open the app and create / connect a wallet

`/login.html` → either **Connect browser wallet** (MetaMask) or **Create
wallet**. If you create one, **save the recovery phrase**.

## 2. Confirm the network

The top-right network selector should say **Sepolia (testnet)**. The blue
banner under the balance confirms it: *"You are on a testnet."*

## 3. Get test ETH

Click the **Get test ETH ↗** link on the testnet banner, or pick one of:

- [Alchemy Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
  (0.5 ETH/day, requires login)
- [Sepolia PoW faucet](https://sepolia-faucet.pk910.de/) (mine in browser)
- [Infura faucet](https://www.infura.io/faucet/sepolia)

Paste the address shown next to **Receive at** on the dashboard. Funding
takes anywhere from 5 seconds to a few minutes.

## 4. Send your first transaction

In the **Send** card:

- **Asset**: Native (ETH/MATIC)
- **Recipient**: any other address you control (or another faucet test
  address)
- **Amount**: e.g. `0.001`

The **Estimated network fee** line updates as you type. Click **Review &
send**, eyeball the confirmation dialog, click **Send**. If you're using
MetaMask the extension pops up to confirm — click "Confirm" there too.

A toast announces "Broadcast: 0xabc…", then a few seconds later "Confirmed
✓". The Transactions card shows the row going from **PENDING** to
**CONFIRMED**, with a "view ↗" link to Sepolia Etherscan.

## 5. Try Polygon Amoy

Open the network picker → **Polygon Amoy (testnet)**. Wallet asks to
switch / add the network — accept. The balance refreshes; faucet for Amoy:
[faucet.polygon.technology](https://faucet.polygon.technology). Send a
small amount the same way.

## 6. Try USDC

USDC's testnet contract on Sepolia is preconfigured. To get test USDC, use
[Circle's faucet](https://faucet.circle.com) (select Sepolia / Ethereum).
Once the balance shows under USDC on the dashboard, use the Send card with
**Asset = USDC**.

## 7. (Optional) Switch to mainnet

Tick **Mainnets** in the top bar. Pick **Ethereum** or **Polygon** in the
selector. A red dialog appears warning you that mainnet is real money. Read
it. If you confirm, the wallet now operates on real funds — every gas
estimate and confirmation is real.

## Troubleshooting

- **Balance shows 0 after funding.** Click ↻ next to the Balance heading.
  The default RPC (`publicnode.com`) sometimes lags behind by ~10 s.
- **"insufficient funds for intrinsic transaction cost"** — you have less
  ETH than the gas fee. Top up.
- **Tx shows "reverted".** The contract rejected the call. For native
  transfers this is rare; for ERC-20 it usually means the token contract
  has a transfer block (e.g. paused, blocklisted) or you tried to send 0.
- **"missing config.js"** — fine, the app falls back to defaults; the
  on-page warning is a CDN console message and does not affect anything.
