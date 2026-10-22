import nodemailer from "nodemailer";
import type { Email } from "../types.js";

const SENDER_NAME = "Amazon Stock Reminder";

/** Sends plain-text emails through Gmail SMTP using an app password. */
export function createMailer(user: string, appPassword: string, to: string) {
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass: appPassword } });

  return {
    send: async (email: Email) => {
      await transport.sendMail({ from: `"${SENDER_NAME}" <${user}>`, to, ...email });
    },
  };
}

export type Mailer = ReturnType<typeof createMailer>;
