import { waitUntil } from "@vercel/functions";
import { isAuthorized } from "../src/auth.js";
import { loadConfig, type Config } from "../src/config.js";
import { runCheck } from "../src/runCheck.js";

/**
 * Entry point, called every 30 minutes by cron-job.org with `Authorization: Bearer <CRON_SECRET>`.
 * Responds 202 immediately and finishes the check in the background, because Amazon
 * retries can outlast cron-job.org's request timeout.
 */
export function GET(request: Request): Response {
  let config: Config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!isAuthorized(request.headers.get("authorization"), config.cronSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  waitUntil(
    runCheck(config)
      .then((report) => console.log("Check finished", JSON.stringify(report)))
      .catch((error: unknown) => console.error("Check run failed:", error)),
  );

  return Response.json({ status: "accepted" }, { status: 202 });
}
