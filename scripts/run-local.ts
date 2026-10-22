/**
 * Runs one check locally against real Amazon, Redis and Gmail, using `.env`.
 *   npm run check:local              normal run
 *   npm run check:local -- --summary also send the daily summary now
 */
import { loadConfig } from "../src/config.js";
import { runCheck } from "../src/runCheck.js";

const report = await runCheck(loadConfig(), { forceSummary: process.argv.includes("--summary") });
console.log(JSON.stringify(report, null, 2));
