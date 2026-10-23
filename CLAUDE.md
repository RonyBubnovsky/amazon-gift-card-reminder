# CLAUDE.md

Amazon stock checker, runs every 30 minutes. Vercel serverless function (`api/check.ts`), triggered by cron-job.org,
state in Upstash Redis, notifications via Gmail SMTP (Nodemailer). Full docs: `PROJECT_DOCUMENTATION.md`.

## Commands

- `npm run typecheck`: strict TypeScript check (no emit; Vercel compiles `api/` itself)
- `npm run lint`: ESLint, including the 150-line file limit
- `npm run check:local`: one real run using `.env` (hits Amazon, Redis, Gmail)
- `npm run check:local -- --summary`: same, plus send the daily summary now

Run `typecheck` and `lint` after every change. Both must pass.

## Layout

```
api/check.ts                 HTTP entry: config, bearer auth, 202 + waitUntil(runCheck)
src/runCheck.ts              orchestration: per product check -> state -> emails; daily summary
src/config.ts                env parsing/validation (zod); single source of config
src/auth.ts                  constant-time bearer token check
src/time.ts                  timezone day/hour + timestamp formatting
src/notifications.ts         which emails a check produces (change, failure threshold)
src/amazon/productUrl.ts     URL allowlist (https Amazon hosts) + ASIN extraction
src/amazon/checkProduct.ts   HTTP fetch (homepage cookie, then product) with retries
src/amazon/parsePage.ts      HTML -> available / unavailable / bot-check / unexpected
src/state/store.ts           Upstash Redis access (product state, summary marker)
src/state/nextState.ts       pure state transition + daily counter reset
src/mail/mailer.ts           Nodemailer Gmail transport
src/mail/templates.ts        plain-text email bodies
scripts/run-local.ts         local runner
```

## Rules

- **No file over 150 lines** (enforced by ESLint `max-lines`). Split by responsibility when close.
- One responsibility per module. Pure logic (`nextState`, `notifications`, `parsePage`) stays free of I/O.
- ESM with NodeNext: relative imports end in `.js` even for `.ts` files.
- Strict TS with `noUncheckedIndexedAccess`. No `any`, no non-null assertions.
- Read env only through `loadConfig()`. New setting: add it to the zod schema, `Config`, `.env.example`
  and the env table in `PROJECT_DOCUMENTATION.md`.
- **Secrets**: never commit `.env`; never log config, tokens, passwords, or error objects that might
  contain them. `.env.example` holds placeholders only.
- Product URLs must pass `parseProductUrl` (https + Amazon host); never fetch arbitrary URLs.
- Emails are plain text. Anything from Amazon HTML is untrusted, so keep subjects single-line.
- **No tests in this project.** The user says what to test and when.
- Don't push, deploy, or change Vercel / cron-job.org / Upstash settings unless the user asks.

## Gotchas

- Amazon serves a "Continue shopping" bot page unless the request carries the session cookie from the
  homepage, so `checkProduct` fetches the homepage first. If bot-check failures spike, look there first.
- Availability markers (verified on amazon.in, Oct 2026): `id="outOfStock"` box = unavailable;
  `id="add-to-cart-button"` / `id="buy-now-button"` = buyable. Match the full `id="..."`: the bare
  names also appear in script/data attributes. If Amazon changes its markup, update `parsePage.ts`.
- The function returns 202 immediately and finishes via `waitUntil` (max 60s, `vercel.json`), because
  retries can outlast cron-job.org's 30s timeout. Results show in Vercel logs, not the HTTP response.
- Emails send before state is saved, so a failed send is retried on the next run.
- Daily summary: the first run at or after `SUMMARY_HOUR` (in `TIMEZONE`) claims a Redis marker (`SET NX`).
- Vercel's Upstash integration sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`; config accepts those or
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
