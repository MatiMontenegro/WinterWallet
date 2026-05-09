// Sign-In With Ethereum (EIP-4361) — minimal client-side message builder.
//
// We do not depend on the `siwe` npm package; the message format is small and
// the only verification happens server-side in the Supabase Edge Function.

import { signMessage } from "./wallet.js";

function randomNonce(len = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildSiweMessage({ address, chainId, domain, uri, statement, nonce }) {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export async function signIn({ address, chainId, statement = "Sign in to WinterWallet" }) {
  const domain = window.location.host;
  const uri = window.location.origin;
  const nonce = randomNonce();
  const message = buildSiweMessage({ address, chainId, domain, uri, statement, nonce });
  const signature = await signMessage(message);
  return { message, signature, nonce, address, chainId };
}
