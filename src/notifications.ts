import { failureAlertEmail, statusChangeEmail } from "./mail/templates.js";
import type { Email, Product, ProductState } from "./types.js";

/** Consecutive failed checks that trigger a single alert email. */
export const FAILURE_ALERT_THRESHOLD = 3;

/** Decides which emails a single product check should produce. */
export function emailsForCheck(
  product: Product,
  prev: ProductState | null,
  next: ProductState,
  timeZone: string,
): Email[] {
  const emails: Email[] = [];
  const previous = prev?.availability ?? null;

  if (next.availability !== null && next.availability !== previous) {
    emails.push(statusChangeEmail(product, previous, next, timeZone));
  }
  // Exactly at the threshold, so one streak produces one alert.
  if (next.consecutiveFailures === FAILURE_ALERT_THRESHOLD) {
    emails.push(failureAlertEmail(product, next, timeZone));
  }
  return emails;
}
