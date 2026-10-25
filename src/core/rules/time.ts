import { config } from "../config/fixx.config";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const addHours = (d: Date, h: number): Date => new Date(d.getTime() + h * HOUR);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);
export const round2 = (n: number): number => Math.round(n * 100) / 100;

const local = (d: Date, off: number): Date => new Date(d.getTime() + off * HOUR);

/** YYYY-MM-DD in local (Monterrey) time. */
export function localDateKey(d: Date, off: number = config.utcOffsetHours): string {
  return local(d, off).toISOString().slice(0, 10);
}

/** Monday to Friday, excluding the configured public holidays. */
export function isBusinessDay(
  d: Date, holidays: readonly string[] = config.holidays2026, off: number = config.utcOffsetHours
): boolean {
  const l = local(d, off);
  const dow = l.getUTCDay();
  return dow >= 1 && dow <= 5 && !holidays.includes(l.toISOString().slice(0, 10));
}

/** Same time of day, n business days later. */
export function addBusinessDays(
  from: Date, n: number, holidays: readonly string[] = config.holidays2026, off: number = config.utcOffsetHours
): Date {
  let d = from, counted = 0;
  while (counted < n) {
    d = addDays(d, 1);
    if (isBusinessDay(d, holidays, off)) counted++;
  }
  return d;
}

const toMin = (s: string): number => { const [h = "0", m = "0"] = s.split(":"); return Number(h) * 60 + Number(m); };
/** True during human Agent hours (config.businessHours, local time). Outside them the Assistant handles chat. */
export function isAgentHours(d: Date, cfg: typeof config = config): boolean {
  const l = local(d, cfg.utcOffsetHours);
  const mins = l.getUTCHours() * 60 + l.getUTCMinutes();
  return cfg.businessHours.days.includes(l.getUTCDay()) && mins >= toMin(cfg.businessHours.start) && mins < toMin(cfg.businessHours.end);
}
