import { checkProduct } from "./amazon/checkProduct.js";
import type { Config } from "./config.js";
import { createMailer, type Mailer } from "./mail/mailer.js";
import { dailySummaryEmail } from "./mail/templates.js";
import { emailsForCheck } from "./notifications.js";
import { nextState } from "./state/nextState.js";
import { createStore, type Store } from "./state/store.js";
import { zonedDayAndHour } from "./time.js";
import type { Product, ProductStatus } from "./types.js";

export interface RunOptions {
  /** Send the daily summary now, ignoring the hour and the once-a-day marker. */
  forceSummary?: boolean;
  now?: Date;
}

export interface RunReport {
  day: string;
  products: { id: string; availability: string | null; error: string | null }[];
  emailsSent: number;
  summarySent: boolean;
}

interface Context {
  config: Config;
  store: Store;
  mailer: Mailer;
  now: Date;
  day: string;
}

async function processProduct(ctx: Context, product: Product): Promise<{ status: ProductStatus; emails: number }> {
  const result = await checkProduct(product.url);
  const prev = await ctx.store.getProduct(product.id);
  const state = nextState(prev, result, ctx.now, ctx.day);
  const emails = emailsForCheck(product, prev, state, ctx.config.timeZone);

  // Email before saving: if sending fails, the state is not saved and the next run retries the notification.
  for (const email of emails) await ctx.mailer.send(email);
  await ctx.store.saveProduct(product.id, state);

  return { status: { product, state }, emails: emails.length };
}

async function sendSummary(ctx: Context, statuses: ProductStatus[], force: boolean): Promise<boolean> {
  if (!force && !(await ctx.store.claimSummary(ctx.day))) return false;
  try {
    await ctx.mailer.send(dailySummaryEmail(statuses, ctx.day, ctx.config.timeZone));
    return true;
  } catch (error) {
    if (!force) await ctx.store.releaseSummary(ctx.day);
    throw error;
  }
}

/** One full run: check every product, send change/failure emails, and the daily summary when due. */
export async function runCheck(config: Config, options: RunOptions = {}): Promise<RunReport> {
  const now = options.now ?? new Date();
  const { day, hour } = zonedDayAndHour(now, config.timeZone);
  const ctx: Context = {
    config,
    now,
    day,
    store: createStore(config.redisUrl, config.redisToken),
    mailer: createMailer(config.gmailUser, config.gmailAppPassword, config.notifyTo),
  };

  const report: RunReport = { day, products: [], emailsSent: 0, summarySent: false };
  const statuses: ProductStatus[] = [];

  // Sequential on purpose: gentler on Amazon, and one failing product must not stop the others.
  for (const product of config.products) {
    try {
      const { status, emails } = await processProduct(ctx, product);
      statuses.push(status);
      report.emailsSent += emails;
      report.products.push({ id: product.id, availability: status.state.availability, error: status.state.lastError });
    } catch (error) {
      console.error(`Processing ${product.id} failed:`, error);
      report.products.push({ id: product.id, availability: null, error: String(error) });
    }
  }

  const summaryDue = options.forceSummary || hour >= config.summaryHour;
  if (summaryDue && statuses.length > 0) {
    report.summarySent = await sendSummary(ctx, statuses, options.forceSummary ?? false);
    if (report.summarySent) report.emailsSent += 1;
  }

  return report;
}
