# Install WinterWallet on your iPhone

WinterWallet is a Progressive Web App — no App Store, no $99/yr Apple
Developer account, no review process. Open the URL in Safari, tap one
button, and you have a real-looking app on your home screen.

## The 20-second install

1. Open **Safari** on your iPhone (not Chrome — only Safari can install
   PWAs on iOS).
2. Visit your deployed URL, e.g. `https://winterwallet.pages.dev`.
3. Tap the **Share** button at the bottom of the screen
   (the square with the up-arrow: <kbd>⇪</kbd>).
4. Scroll the share sheet and tap **Add to Home Screen**.
5. Edit the name if you want, tap **Add**.

That's it. There's now a WinterWallet icon on your home screen that opens
fullscreen, hides Safari's chrome, and behaves like a native app.

## What changes after installing

| Before (Safari tab) | After (home-screen app) |
| --- | --- |
| URL bar visible, share button takes space | Fullscreen, no Safari UI |
| Looks like a website | Looks like an app |
| Subject to Safari's aggressive memory eviction | Survives in its own task |
| 7-day cookie purge on inactive sites | Persistent storage |

The wallet itself behaves identically — same keys, same balances, same
history (Safari and the home-screen app share storage).

## Connecting a wallet on iPhone

Three options, from easiest to most advanced:

1. **Coinbase Wallet, Trust, Rainbow, MetaMask app** — install the wallet
   from the App Store *first*, then in WinterWallet tap **Connect** →
   **WalletConnect** → scan the QR or pick the app. The wallet pops up,
   you approve, control returns to WinterWallet.
2. **MetaMask mobile in-app browser** — open MetaMask, tap the browser tab,
   visit your URL. MetaMask injects directly. (No PWA install needed in
   this mode, but the URL won't be on your home screen.)
3. **Hardware wallet via WalletConnect** — Ledger Live mobile, then
   WalletConnect as in (1).

## Known iOS quirks

- **No `beforeinstallprompt`.** Safari does not fire this event, so we
  cannot trigger the install dialog programmatically. The in-app banner
  is purely a tutorial pointing at the Share button.
- **Camera-based QR scanning** requires HTTPS and a user gesture. Cloudflare
  Pages provides HTTPS automatically.
- **Cold-start latency.** First open after a few days in the background
  takes ~1 s on older iPhones — that's the service worker rebooting. The
  workbox cache makes subsequent opens instant.
- **Storage**: iOS clears PWA storage if the device gets close to "out of
  space" or if the app hasn't been opened in many weeks. Anything that
  matters (your transactions) is in the cloud (Supabase) or on the chain;
  local storage is just a cache.

## Verifying you're in the installed PWA

In the running app, navigate to the home screen, then back. If Safari's
URL bar is gone and a screen edge is visible at the top in the safe area,
you're in standalone mode. The InstallPrompt banner won't appear once
you're standalone.

## Troubleshooting

**"Add to Home Screen" is missing.** You opened the site in Chrome, not
Safari. Switch to Safari. (Or, more accurately: only WebKit on iOS can
install PWAs, and on iOS *every* browser secretly uses WebKit, but only
Safari exposes the share-sheet item.)

**The icon is a screenshot, not the WinterWallet logo.** The deploy didn't
include `apple-touch-icon-180x180.png` correctly. Verify
`curl -I https://yourdomain/apple-touch-icon-180x180.png` returns 200. If
not, run `pnpm generate-pwa-assets` locally and commit the regenerated
PNGs.

**The PWA opens to a blank screen.** Open Safari Web Inspector from a Mac
(Safari → Preferences → Advanced → Show Develop menu → your iPhone) and
check the console. Most likely culprits: `VITE_SUPABASE_URL` not set,
missing `VITE_WALLETCONNECT_PROJECT_ID`, or a CSP mistake in `public/_headers`.
