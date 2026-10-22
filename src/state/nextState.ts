import type { CheckResult, ProductState } from "../types.js";

const INITIAL: Omit<ProductState, "day"> = {
  availability: null,
  title: "",
  lastCheckedAt: "",
  lastError: null,
  consecutiveFailures: 0,
  checksToday: 0,
  failuresToday: 0,
};

/** Pure transition: previous state + check result -> new state. Daily counters reset on a new day. */
export function nextState(prev: ProductState | null, result: CheckResult, now: Date, day: string): ProductState {
  const base: ProductState =
    prev?.day === day ? prev : { ...INITIAL, ...prev, day, checksToday: 0, failuresToday: 0 };
  const checked = { ...base, lastCheckedAt: now.toISOString(), checksToday: base.checksToday + 1 };

  if (result.ok) {
    return {
      ...checked,
      availability: result.availability,
      title: result.title,
      lastError: null,
      consecutiveFailures: 0,
    };
  }

  return {
    ...checked,
    lastError: result.reason,
    consecutiveFailures: base.consecutiveFailures + 1,
    failuresToday: base.failuresToday + 1,
  };
}
