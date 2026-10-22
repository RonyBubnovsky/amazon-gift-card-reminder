import type { CheckResult } from "../types.js";
import { parseProductPage } from "./parsePage.js";

const ATTEMPTS = 3;
const TIMEOUT_MS = 10_000;
const RETRY_BASE_DELAY_MS = 2_000;

// Plain HTTP with browser-like headers; Amazon serves a bot page to obvious bots.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const response = await fetch(url, {
    headers: { ...HEADERS, ...extraHeaders },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).pathname}`);
  return response;
}

/**
 * Visits the homepage first, like a browser, and reuses its session cookie.
 * Without it Amazon answers product requests with a "Continue shopping" bot page.
 */
async function fetchProductHtml(url: string): Promise<string> {
  const origin = new URL(url).origin;
  const home = await get(`${origin}/`);
  await home.arrayBuffer();
  const cookie = home.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const product = await get(url, { Cookie: cookie, Referer: `${origin}/` });
  return product.text();
}

/** Fetches and classifies a product page, retrying bot pages, timeouts and HTTP errors. */
export async function checkProduct(url: string): Promise<CheckResult> {
  let lastReason = "No attempt made";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const result = parseProductPage(await fetchProductHtml(url));
      if (result.ok) return result;
      lastReason = result.reason;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }
    if (attempt < ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS * attempt);
  }

  return { ok: false, reason: `${lastReason} (after ${ATTEMPTS} attempts)` };
}
