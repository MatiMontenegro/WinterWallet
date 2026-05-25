// Lightweight CoinGecko price oracle. Cached for PRICE_TTL_MS to stay under
// the public rate limit. No API key required.

const PRICE_TTL_MS = 60_000;
type CacheEntry = { ts: number; value: Record<string, number> };
const cache = new Map<string, CacheEntry>();

const COIN_ID_BY_SYMBOL: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  MATIC: "matic-network",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BTC: "bitcoin",
};

export function coinIdFor(symbol: string | null | undefined): string | null {
  return symbol ? COIN_ID_BY_SYMBOL[symbol.toUpperCase()] ?? null : null;
}

export async function getPrices(symbols: string[], vs = "usd"): Promise<Record<string, number>> {
  const upper = symbols.map((s) => s.toUpperCase());
  const ids = [...new Set(upper.map(coinIdFor).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return {};
  const key = `${ids.sort().join(",")}|${vs}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < PRICE_TTL_MS) return hit.value;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${vs}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`Price API ${r.status}`);
    const data = (await r.json()) as Record<string, Record<string, number>>;
    const out: Record<string, number> = {};
    for (const sym of upper) {
      const id = coinIdFor(sym);
      if (id && data[id]?.[vs] != null) out[sym] = data[id][vs];
    }
    cache.set(key, { ts: Date.now(), value: out });
    return out;
  } catch {
    return hit?.value ?? {};
  }
}
