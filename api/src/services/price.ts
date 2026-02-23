// BCH Price Service
// Fetches and caches BCH/USD price from CoinGecko public API.

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd";

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CachedPrice {
  usd: number;
  updatedAt: Date;
}

let cachedPrice: CachedPrice | null = null;
let cacheExpiry = 0;

async function fetchPrice(): Promise<CachedPrice> {
  const res = await fetch(COINGECKO_URL);
  if (!res.ok) {
    throw new Error(`CoinGecko API returned ${res.status}`);
  }
  const data = (await res.json()) as {
    "bitcoin-cash"?: { usd?: number };
  };
  const usd = data["bitcoin-cash"]?.usd;
  if (typeof usd !== "number") {
    throw new Error("Unexpected CoinGecko response format");
  }
  return { usd, updatedAt: new Date() };
}

export async function getBchPrice(): Promise<CachedPrice> {
  const now = Date.now();
  if (cachedPrice && now < cacheExpiry) {
    return cachedPrice;
  }

  try {
    cachedPrice = await fetchPrice();
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (err) {
    // Fall back to last known price if available
    if (cachedPrice) {
      console.warn("[Price] Fetch failed, using stale cache:", err);
      return cachedPrice;
    }
    throw err;
  }

  return cachedPrice;
}

export function convertBchToUsd(satoshis: bigint, rate: number): number {
  const bch = Number(satoshis) / 1e8;
  return bch * rate;
}

export function convertUsdToBch(usd: number, rate: number): bigint {
  const bch = usd / rate;
  return BigInt(Math.round(bch * 1e8));
}
