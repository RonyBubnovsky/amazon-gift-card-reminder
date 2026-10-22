# Amazon Gift Card Reminder: Project Documentation

Checks Amazon product pages every hour. Emails you when a product comes in stock (or goes out of
stock), sends one daily summary, and alerts you if checks keep failing. Runs 24/7 on free tiers:
Vercel (function), cron-job.org (hourly trigger), Upstash Redis (state), Gmail (email).

## How it works

```
cron-job.org (hourly) --GET /api/check + Bearer token--> Vercel function --> 202 Accepted
                                                              |  (continues in background)
                                   for each product: amazon.in homepage -> product page
                                   parse -> compare with last state (Upstash Redis)
                                   -> emails via Gmail SMTP -> save state
                                   -> daily summary at/after SUMMARY_HOUR
```

| Email | When |
|---|---|
| Now watching | First successful check of a product |
| ✅ In stock / ❌ Out of stock again | Status changed since the last successful check |
| ⚠️ Checks failing | Exactly 3 failed checks in a row (one alert per failure streak) |
| Daily summary | First run at or after `SUMMARY_HOUR`, once per day |

A check **fails** when, after 3 attempts, Amazon still returns a bot page, an HTTP error, a timeout,
or an unrecognized page. **Available** means the page has a buy button and no "Currently unavailable" box.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GMAIL_USER` | yes | Gmail address that sends the emails |
| `GMAIL_APP_PASSWORD` | yes | 16-character Google app password (spaces allowed) |
| `NOTIFY_TO` | no | Recipient; defaults to `GMAIL_USER` |
| `PRODUCT_URLS` | yes | Comma-separated https Amazon product URLs (tracking params are stripped) |
| `CRON_SECRET` | yes | Bearer token cron-job.org must send; 32+ characters |
| `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL` | yes | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN` | yes | Upstash REST token |
| `TIMEZONE` | no | IANA timezone, default `Asia/Jerusalem` |
| `SUMMARY_HOUR` | no | 0-23 in `TIMEZONE`, default `12` |

Invalid config makes the endpoint return 500. The logs say which variables are wrong, never their values.

## Local setup

1. `npm install`
2. `cp .env.example .env` and fill it in. For Redis, copy the REST URL and token from the Upstash
   console, or run `npx vercel env pull .env` after the Vercel setup below.
3. `npm run check:local` (add `-- --summary` to also send the daily summary).

## Deployment

### 1. Vercel project

1. Push the repo to GitHub. Keep it private (no secrets are in it either way).
2. Vercel → **Add New → Project** → import the repo. Framework preset: **Other**. No build settings.
3. **Storage** tab → **Create Database** → **Upstash for Redis** (free plan) → connect it to the
   project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. **Settings → Environment Variables** (Production): add `GMAIL_USER`, `GMAIL_APP_PASSWORD`,
   `NOTIFY_TO`, `PRODUCT_URLS`, `CRON_SECRET`, `TIMEZONE`, `SUMMARY_HOUR`. Mark the password and
   the secret as **Sensitive**.
5. **Deployments** → redeploy so the variables apply.
6. Test: `curl -i -H "Authorization: Bearer <CRON_SECRET>" https://<project>.vercel.app/api/check`
   returns `202`; without the header it returns `401`. The result appears in the function logs, and
   the first run emails "Now watching".

Functions run in `bom1` (Mumbai, close to amazon.in), set in `vercel.json`.

### 2. cron-job.org

**Create cronjob**:
- URL: `https://<project>.vercel.app/api/check`
- Schedule: every hour, at minute `0`
- **Advanced → Headers**: `Authorization` = `Bearer <CRON_SECRET>`
- Request method: `GET`
- Notifications: enable "on failure" so you hear about it if the endpoint itself breaks.

### 3. Rotating secrets

- **Gmail app password**: create a new one at https://myaccount.google.com/apppasswords, update
  `GMAIL_APP_PASSWORD` in Vercel and `.env`, redeploy, then revoke the old one.
- **CRON_SECRET**: generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, then update Vercel and
  the cron-job.org header, and redeploy.

## Free-tier usage

- Vercel Hobby: 24 invocations a day, a few seconds each, far below the limits. Hobby is for personal,
  non-commercial use.
- Upstash: about 3 commands per product per run (roughly 2-5k a month); the free tier allows 500k a month.
- Gmail: a handful of emails a day; the sending limit is 500 a day.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| ⚠️ alert "Blocked by Amazon bot check" | Amazon flagged the Vercel IP or changed its bot page. Occasional failures are normal; persistent ones need a look at `src/amazon/checkProduct.ts`. |
| "Unexpected page: no product title found" | Product removed, wrong URL, or Amazon markup changed (`src/amazon/parsePage.ts`). |
| Always "Not available" while the page is buyable | Buy-button or out-of-stock markers changed (`src/amazon/parsePage.ts`). |
| 401 in cron-job.org history | Header missing or `CRON_SECRET` mismatch. |
| 500 in cron-job.org history | Invalid or missing env vars; see the Vercel function logs. |
| No emails at all | Gmail app password revoked or wrong, or 2-Step Verification turned off. |
