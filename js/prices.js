// Price oracle backed by CoinGecko's free, key-less endpoint.
// Cached for PRICE_TTL_MS to stay under the public rate limit.

const PRICE_TTL_MS = 60_000;
const cache = new Map(); // key: `${id}:${vs}` → { ts, value }

const COIN_ID_BY_SYMBOL = {
  ETH: "ethereum",
  MATIC: "matic-network",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BTC: "bitcoin",
};

export function coinIdFor(symbol) {
  return COIN_ID_BY_SYMBOL[symbol?.toUpperCase()] ?? null;
}

export async function getPrice(symbol, vs = "usd") {
  const id = coinIdFor(symbol);
  if (!id) return null;
  const key = `${id}:${vs}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < PRICE_TTL_MS) return hit.value;

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(vs)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Price API ${r.status}`);
    const data = await r.json();
    const value = data?.[id]?.[vs] ?? null;
    cache.set(key, { ts: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? null; // serve stale on error
  }
}

export async function getPrices(symbols, vs = "usd") {
  const ids = [...new Set(symbols.map(coinIdFor).filter(Boolean))];
  if (ids.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${vs}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Price API ${r.status}`);
    const data = await r.json();
    const out = {};
    for (const sym of symbols) {
      const id = coinIdFor(sym);
      if (id && data[id]) out[sym.toUpperCase()] = data[id][vs];
    }
    return out;
  } catch {
    return {};
  }
}
