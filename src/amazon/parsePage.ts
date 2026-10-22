import type { CheckResult } from "../types.js";

const BOT_CHECK_MARKERS = [
  "/errors/validateCaptcha",
  "/errors_page/validateCaptcha",
  "Type the characters you see",
  "api-services-support@amazon.com",
];
// Match element ids exactly: the bare names also appear inside script/data attributes.
const BUY_BUTTON_IDS = ['id="add-to-cart-button"', 'id="buy-now-button"'];
const OUT_OF_STOCK_ID = 'id="outOfStock"';
const TITLE_PATTERN = /<span[^>]*id="productTitle"[^>]*>([\s\S]*?)<\/span>/;

const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">" };

function decodeEntities(text: string): string {
  return text.replace(/&(amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * Classifies an Amazon product page. Plain string search instead of a DOM parser:
 * cheap, dependency-free, and enough for a few known markers.
 * Available = a buy button element exists and the "Currently unavailable" box (#outOfStock) does not.
 */
export function parseProductPage(html: string): CheckResult {
  if (BOT_CHECK_MARKERS.some((marker) => html.includes(marker))) {
    return { ok: false, reason: "Blocked by Amazon bot check" };
  }

  const rawTitle = TITLE_PATTERN.exec(html)?.[1];
  if (!rawTitle) {
    return { ok: false, reason: "Unexpected page: no product title found" };
  }

  const hasBuyButton = BUY_BUTTON_IDS.some((id) => html.includes(id));
  const isOutOfStock = html.includes(OUT_OF_STOCK_ID);

  return {
    ok: true,
    availability: hasBuyButton && !isOutOfStock ? "available" : "unavailable",
    title: decodeEntities(rawTitle.replace(/\s+/g, " ").trim()),
  };
}
