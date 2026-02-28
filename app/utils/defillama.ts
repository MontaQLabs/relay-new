/**
 * DeFiLlama API helper for fetching live protocol TVL data.
 *
 * Uses the free, no-auth-required DeFiLlama API:
 *   https://defillama.com/docs/api
 *
 * The /protocols endpoint returns all protocols in a single response (~200KB).
 * We cache the result in memory with a 5-minute TTL to avoid repeated calls.
 */

export interface ProtocolTvlInfo {
  tvl: number;
  change_1d: number | null;
}

interface DefiLlamaProtocol {
  slug: string;
  tvl: number;
  change_1d: number | null;
}

const DEFILLAMA_API = "https://api.llama.fi";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedProtocols: Map<string, ProtocolTvlInfo> | null = null;
let cacheTimestamp = 0;

/**
 * Fetch all protocols from DeFiLlama and build a slug -> TVL map.
 * Results are cached in memory for 5 minutes.
 */
async function fetchAllProtocols(): Promise<Map<string, ProtocolTvlInfo>> {
  const now = Date.now();
  if (cachedProtocols && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProtocols;
  }

  try {
    const res = await fetch(`${DEFILLAMA_API}/protocols`, {
      next: { revalidate: 300 }, // Next.js fetch cache: 5 min
    });

    if (!res.ok) {
      console.error(`DeFiLlama API returned ${res.status}`);
      return cachedProtocols ?? new Map();
    }

    const protocols: DefiLlamaProtocol[] = await res.json();
    const map = new Map<string, ProtocolTvlInfo>();

    for (const p of protocols) {
      if (p.slug) {
        map.set(p.slug, {
          tvl: p.tvl ?? 0,
          change_1d: p.change_1d ?? null,
        });
      }
    }

    cachedProtocols = map;
    cacheTimestamp = now;
    return map;
  } catch (error) {
    console.error("Failed to fetch DeFiLlama protocols:", error);
    return cachedProtocols ?? new Map();
  }
}

/**
 * Look up TVL data for a list of DeFiLlama slugs.
 *
 * @param slugs - Array of DeFiLlama protocol slugs to look up
 * @returns Map from slug to TVL info (only includes slugs that were found)
 */
export async function fetchProtocolsTvl(slugs: string[]): Promise<Map<string, ProtocolTvlInfo>> {
  if (slugs.length === 0) return new Map();

  const allProtocols = await fetchAllProtocols();
  const result = new Map<string, ProtocolTvlInfo>();

  for (const slug of slugs) {
    const info = allProtocols.get(slug);
    if (info) {
      result.set(slug, info);
    }
  }

  return result;
}

/**
 * Format a TVL number into a human-readable string.
 * e.g. 1_234_567 -> "$1.23M", 1_234_567_890 -> "$1.23B"
 */
export function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(1)}K`;
  return `$${tvl.toFixed(0)}`;
}
