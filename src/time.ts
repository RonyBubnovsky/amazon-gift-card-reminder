/** Calendar day (YYYY-MM-DD) and hour (0-23) of `date` in `timeZone`. */
export function zonedDayAndHour(date: Date, timeZone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

/** Human-readable timestamp, e.g. "22 Oct 2026, 12:00". */
export function formatTimestamp(iso: string, timeZone: string): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}
