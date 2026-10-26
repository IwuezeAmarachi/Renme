import type { Item } from "./model";

const DAY = 86_400_000;

export const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse YYYY-MM-DD (+ optional HH:MM) as LOCAL time, so DST and time zones behave. */
export function parseLocal(date: string, time?: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole calendar days from `from` to `to` (DST-safe via rounding). */
export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);

/** Next calendar occurrence of a yearly date on/after `now`. Feb 29 → Feb 28 in non-leap years. */
export function nextYearly(date: string, now: Date): Date {
  const [, m, d] = date.split("-").map(Number);
  const make = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const day = m === 2 && d === 29 && !leap ? 28 : d;
    return new Date(y, m - 1, day);
  };
  let cand = make(now.getFullYear());
  if (daysBetween(now, cand) < 0) cand = make(now.getFullYear() + 1);
  return cand;
}

/** The date this item is next "due". Recurring dates roll forward automatically. */
export function occurrence(item: Item, now = new Date()): Date {
  if (item.yearly) {
    const n = nextYearly(item.date, now);
    return parseLocal(toISO(n), item.time);
  }
  return parseLocal(item.date, item.time);
}

export function yearsSince(item: Item, occ: Date): number {
  return occ.getFullYear() - Number(item.date.slice(0, 4));
}

export function relative(item: Item, now = new Date()): string {
  const n = daysBetween(now, occurrence(item, now));
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  if (n < 14) return `In ${n} days`;
  if (n < 60) return `In ${Math.round(n / 7)} weeks`;
  return `In ${Math.round(n / 30)} months`;
}

export type Bucket = "Overdue" | "Today" | "Tomorrow" | "This week" | "Later";
export const BUCKETS: Bucket[] = ["Overdue", "Today", "Tomorrow", "This week", "Later"];

export function bucketOf(item: Item, now = new Date()): Bucket {
  const occ = occurrence(item, now);
  const n = daysBetween(now, occ);
  if (n < 0) return "Overdue";
  if (n === 0) {
    // timed items earlier today that already passed are overdue
    if (item.time && occ.getTime() < now.getTime() && !item.yearly) return "Overdue";
    return "Today";
  }
  if (n === 1) return "Tomorrow";
  if (n <= 7) return "This week";
  return "Later";
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
export const fmtTime = (t?: string) =>
  t ? parseLocal("2000-01-01", t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";

/**
 * Every notification instant for an item: one per lead day, at the item's time
 * (or the default time for all-day items). Built from LOCAL calendar fields,
 * so a "9:00" alert stays at 9:00 across DST changes.
 */
export function fireTimes(item: Item, defaultTime: string, now = new Date()): { key: string; at: Date; lead: number }[] {
  if (item.done) return [];
  const occ = occurrence(item, now);
  const out: { key: string; at: Date; lead: number }[] = [];
  for (const lead of item.leadDays) {
    const base = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate() - lead);
    const [hh, mm] = (item.time ?? defaultTime).split(":").map(Number);
    base.setHours(hh, mm, 0, 0);
    // key includes the occurrence date so yearly repeats notify again each year
    out.push({ key: `${item.id}|${toISO(occ)}|${lead}`, at: base, lead });
  }
  return out;
}
