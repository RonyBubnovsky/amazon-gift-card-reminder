# Amazon Gift Card Reminder

A small service that keeps an eye on Amazon product pages for you. Every 30 minutes it checks whether a
product is in stock and sends you an email the moment that changes, so you don't have to keep
refreshing the page yourself.

It runs 24/7 in the cloud on free plans, with no server to look after.

## What it does

- Checks your products every 30 minutes.
- Emails you when a product comes back in stock, or goes out of stock again.
- Sends one short daily summary, so you know it's still running.
- Warns you if checks keep failing (for example, if Amazon blocks a request three times in a row).
- Watches any number of products: just add more URLs to the config.

## How it works

1. **cron-job.org** calls the service every 30 minutes, using a secret token.
2. A **Vercel** serverless function loads each product page from Amazon and reads whether it can be
   bought.
3. The result is compared with the last known status, which is stored in **Upstash Redis**.
4. If something changed, an email goes out through **Gmail**.

## Tech stack

| Part | Used for |
|---|---|
| TypeScript on Node.js | The application code |
| Vercel Functions | Hosting the check |
| cron-job.org | Triggering the check every 30 minutes |
| Upstash Redis | Remembering each product's last status |
| Nodemailer + Gmail | Sending the emails |
| Zod | Validating configuration at startup |
| ESLint | Code style, including a 150-line limit per file |

## Getting started

```bash
npm install
cp .env.example .env    # then fill in your values
npm run check:local     # runs one real check
```

Before committing, run `npm run typecheck` and `npm run lint`.

Configuration, deployment, and troubleshooting are covered step by step in
[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).

## Security

- Secrets live only in `.env` (never committed) and in Vercel's environment variables.
- The endpoint rejects any request without the correct secret token.
- Only https Amazon product URLs are accepted, so the service can't be pointed at other sites.
