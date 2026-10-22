import { createHash, timingSafeEqual } from "node:crypto";

const BEARER = "Bearer ";

// Hashing first gives equal-length buffers, so the comparison leaks neither content nor length.
const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time check of an `Authorization: Bearer <secret>` header. */
export function isAuthorized(header: string | null, secret: string): boolean {
  if (!header?.startsWith(BEARER)) return false;
  return timingSafeEqual(digest(header.slice(BEARER.length)), digest(secret));
}
