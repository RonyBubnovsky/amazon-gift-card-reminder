import { formatTimestamp } from "../time.js";
import type { Availability, Email, Product, ProductState, ProductStatus } from "../types.js";

const SUBJECT_TITLE_MAX = 70;

// Page titles come from Amazon: keep subjects single-line and short.
function subjectTitle(state: ProductState, product: Product): string {
  const title = (state.title || product.id).replace(/[\r\n\t]+/g, " ");
  return title.length > SUBJECT_TITLE_MAX ? `${title.slice(0, SUBJECT_TITLE_MAX - 1)}…` : title;
}

const label = (availability: Availability | null) =>
  availability === "available" ? "IN STOCK" : availability === "unavailable" ? "Not available" : "Unknown";

export function statusChangeEmail(
  product: Product,
  previous: Availability | null,
  state: ProductState,
  timeZone: string,
): Email {
  const title = subjectTitle(state, product);
  const subject =
    previous === null
      ? `Now watching: ${title} (${label(state.availability)})`
      : state.availability === "available"
        ? `✅ In stock: ${title}`
        : `❌ Out of stock again: ${title}`;

  return {
    subject,
    text: [
      `${state.title || product.id}`,
      ``,
      `Status: ${label(state.availability)} (was: ${label(previous)})`,
      `Checked: ${formatTimestamp(state.lastCheckedAt, timeZone)}`,
      `Link: ${product.url}`,
    ].join("\n"),
  };
}

export function failureAlertEmail(product: Product, state: ProductState, timeZone: string): Email {
  return {
    subject: `⚠️ Checks failing: ${subjectTitle(state, product)}`,
    text: [
      `The last ${state.consecutiveFailures} checks for this product failed.`,
      ``,
      `Last error: ${state.lastError ?? "unknown"}`,
      `Last attempt: ${formatTimestamp(state.lastCheckedAt, timeZone)}`,
      `Last known status: ${label(state.availability)}`,
      `Link: ${product.url}`,
      ``,
      `Checks keep running every hour. You will get another alert only after a`,
      `successful check followed by a new streak of failures.`,
    ].join("\n"),
  };
}

export function dailySummaryEmail(statuses: ProductStatus[], day: string, timeZone: string): Email {
  const inStock = statuses.filter((s) => s.state.availability === "available").length;
  const sections = statuses.map(({ product, state }) =>
    [
      `• ${state.title || product.id}`,
      `  Status: ${label(state.availability)}`,
      `  Checks today: ${state.checksToday} (${state.failuresToday} failed)`,
      `  Last check: ${formatTimestamp(state.lastCheckedAt, timeZone)}`,
      ...(state.lastError ? [`  Last error: ${state.lastError}`] : []),
      `  ${product.url}`,
    ].join("\n"),
  );

  return {
    subject: `Daily summary ${day}: ${inStock}/${statuses.length} in stock`,
    text: [`Stock checker is running. Status as of this run:`, ...sections].join("\n\n"),
  };
}
