import type { Product } from "../types.js";

const AMAZON_HOST = /^(www\.)?amazon\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const ASIN_IN_PATH = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i;

/**
 * Validates an Amazon product URL and strips tracking parameters.
 * Returns null for anything that is not an https Amazon product page,
 * so the fetcher can never be pointed at an arbitrary host.
 */
export function parseProductUrl(raw: string): Product | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !AMAZON_HOST.test(url.hostname)) return null;

  const asin = ASIN_IN_PATH.exec(url.pathname)?.[1]?.toUpperCase();
  if (!asin) return null;

  return { id: asin, url: `${url.origin}/dp/${asin}` };
}
