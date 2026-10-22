export type Availability = "available" | "unavailable";

export interface Product {
  /** Amazon ASIN, used as the storage key. */
  id: string;
  /** Canonical product URL without tracking parameters. */
  url: string;
}

export type CheckResult =
  | { ok: true; availability: Availability; title: string }
  | { ok: false; reason: string };

export interface ProductState {
  /** null until the first successful check. */
  availability: Availability | null;
  title: string;
  lastCheckedAt: string;
  lastError: string | null;
  consecutiveFailures: number;
  /** Day (YYYY-MM-DD, configured timezone) the daily counters belong to. */
  day: string;
  checksToday: number;
  failuresToday: number;
}

export interface ProductStatus {
  product: Product;
  state: ProductState;
}

export interface Email {
  subject: string;
  text: string;
}
