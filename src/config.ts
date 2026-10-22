import { z } from "zod";
import { parseProductUrl } from "./amazon/productUrl.js";
import type { Product } from "./types.js";

export interface Config {
  gmailUser: string;
  gmailAppPassword: string;
  notifyTo: string;
  products: Product[];
  cronSecret: string;
  redisUrl: string;
  redisToken: string;
  timeZone: string;
  summaryHour: number;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const productList = z.string().transform((value, ctx): Product[] => {
  const urls = value.split(",").map((s) => s.trim()).filter(Boolean);
  const products: Product[] = [];
  for (const raw of urls) {
    const product = parseProductUrl(raw);
    if (!product) {
      ctx.addIssue({ code: "custom", message: `Not an https Amazon product URL: ${raw}` });
      return z.NEVER;
    }
    products.push(product);
  }
  if (products.length === 0) {
    ctx.addIssue({ code: "custom", message: "At least one URL is required" });
    return z.NEVER;
  }
  return products;
});

const envSchema = z.object({
  GMAIL_USER: z.email(),
  // Google displays app passwords in groups of four; spaces are not part of the password.
  GMAIL_APP_PASSWORD: z
    .string()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().length(16, "Must be a 16-character Gmail app password")),
  NOTIFY_TO: z.email().optional(),
  PRODUCT_URLS: productList,
  CRON_SECRET: z.string().min(32, "Must be at least 32 characters"),
  REDIS_URL: z.url({ protocol: /^https$/ }),
  REDIS_TOKEN: z.string().min(1),
  TIMEZONE: z.string().refine(isValidTimeZone, "Unknown IANA timezone").default("Asia/Jerusalem"),
  SUMMARY_HOUR: z.coerce.number().int().min(0).max(23).default(12),
});

let cached: Config | undefined;

/** Parses and validates environment variables once. Error messages never include secret values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;

  // Treat blank values as unset so defaults apply.
  const present = Object.fromEntries(Object.entries(env).filter(([, v]) => v?.trim()));
  const parsed = envSchema.safeParse({
    ...present,
    // Accept both the Upstash names and the names the Vercel Upstash integration sets.
    REDIS_URL: present.UPSTASH_REDIS_REST_URL ?? present.KV_REST_API_URL,
    REDIS_TOKEN: present.UPSTASH_REDIS_REST_TOKEN ?? present.KV_REST_API_TOKEN,
  });
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }

  const e = parsed.data;
  cached = {
    gmailUser: e.GMAIL_USER,
    gmailAppPassword: e.GMAIL_APP_PASSWORD,
    notifyTo: e.NOTIFY_TO ?? e.GMAIL_USER,
    products: e.PRODUCT_URLS,
    cronSecret: e.CRON_SECRET,
    redisUrl: e.REDIS_URL,
    redisToken: e.REDIS_TOKEN,
    timeZone: e.TIMEZONE,
    summaryHour: e.SUMMARY_HOUR,
  };
  return cached;
}
