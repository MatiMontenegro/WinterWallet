# Smart contracts

This folder contains the on-chain code that powers WinterWallet's monetization.

## `FeeRouter.sol`

A minimal, hard-capped (1%) router that lets you collect a commission on
every transfer made through the wallet, in a single user-signed transaction.

### Deploy with Remix (5 minutes, no toolchain)

1. Open <https://remix.ethereum.org>.
2. Create `FeeRouter.sol` and paste the contents of this folder.
3. Solidity Compiler tab → version `0.8.24`, optimizer **enabled**, runs
   `200`. Click **Compile**.
4. Deploy & Run tab:
   - Environment: **Injected Provider — MetaMask**.
   - Make sure MetaMask is on the chain you want (start with Sepolia).
   - In the *Deploy* box, expand the constructor and supply:
     - `_owner` — the address that will collect fees (yours).
     - `_feeBps` — your commission in basis points, e.g. `30` for 0.30%.
   - Click **Deploy**, confirm in MetaMask.
5. Copy the deployed address. Add it to your env vars:
   ```
   VITE_FEE_ROUTER_SEPOLIA=0x…
   VITE_FEE_BPS=30
   ```
6. (Optional but recommended) Verify the contract on Etherscan via the
   **Etherscan Verify** plugin in Remix or `forge verify-contract`.

### Deploy with Foundry

```bash
forge create contracts/FeeRouter.sol:FeeRouter \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $OWNER_ADDRESS 30
```

### Operations

- **Check accumulated fees**: read `accumulated(address(0))` for native,
  `accumulated(<tokenAddress>)` for ERC-20.
- **Withdraw**: call `withdraw(address(0))` for native or
  `withdraw(<tokenAddress>)` for ERC-20. Owner only.
- **Change fee** (within the 1% cap): `setFeeBps(newBps)`. Owner only.
- **Transfer ownership**: two-step. Current owner calls
  `proposeOwner(newOwner)`; the new owner then calls `acceptOwner()`.

### Why a contract instead of two transactions?

A naive "send to recipient + send fee to operator" needs **two**
signatures, **two** gas payments, and is non-atomic (if the fee tx fails
the recipient still gets the money — or vice-versa). The router collapses
it to a **single user signature**, **single gas payment**, and the fee /
recipient split is enforced atomically by the contract.

### Why the 1% cap?

Trust. The fee is encoded in the deployed bytecode and capped by the
constant `MAX_FEE_BPS`. Users can verify on a block explorer that the
operator can never silently raise the fee beyond 1%.

### Audit status

This contract is **not** independently audited. Read it (~150 lines) and
test it on Sepolia before deploying to mainnet. See `docs/SECURITY.md` for
the assumptions baked in.
