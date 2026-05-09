// Password-based encryption for in-browser wallet secrets.
//
// Algorithm: PBKDF2-HMAC-SHA256 (210,000 iterations) → AES-GCM 256-bit.
// Iteration count follows OWASP 2023 guidance for PBKDF2-SHA256.
//
// Output is a self-describing JSON envelope so the format can evolve.

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERSION = 1;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(plaintext, password) {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  return JSON.stringify({
    v: VERSION,
    kdf: "PBKDF2-SHA256",
    iter: ITERATIONS,
    cipher: "AES-GCM",
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(new Uint8Array(ciphertext)),
  });
}

export async function decryptString(envelopeJson, password) {
  const env = JSON.parse(envelopeJson);
  if (env.v !== VERSION) throw new Error(`Unsupported envelope version: ${env.v}`);
  const salt = fromB64(env.salt);
  const iv = fromB64(env.iv);
  const ct = fromB64(env.ct);
  const key = await deriveKey(password, salt);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return dec.decode(plaintext);
  } catch (e) {
    // AES-GCM auth failure → wrong password (or tampered ciphertext).
    throw new Error("Incorrect password.");
  }
}
