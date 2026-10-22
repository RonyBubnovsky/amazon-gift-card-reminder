import { Redis } from "@upstash/redis";
import type { ProductState } from "../types.js";

const PREFIX = "agcr";
const SUMMARY_MARKER_TTL_SECONDS = 2 * 24 * 60 * 60;

const productKey = (id: string) => `${PREFIX}:product:${id}`;
const summaryKey = (day: string) => `${PREFIX}:summary:${day}`;

/** Persistence for per-product state and the once-a-day summary marker. */
export function createStore(url: string, token: string) {
  const redis = new Redis({ url, token });

  return {
    getProduct: (id: string) => redis.get<ProductState>(productKey(id)),

    saveProduct: async (id: string, state: ProductState) => {
      await redis.set(productKey(id), state);
    },

    /** Atomically marks today's summary as sent. Returns false if it already was. */
    claimSummary: async (day: string) =>
      (await redis.set(summaryKey(day), "1", { nx: true, ex: SUMMARY_MARKER_TTL_SECONDS })) === "OK",

    /** Undoes a claim so the next run retries after a failed send. */
    releaseSummary: async (day: string) => {
      await redis.del(summaryKey(day));
    },
  };
}

export type Store = ReturnType<typeof createStore>;
