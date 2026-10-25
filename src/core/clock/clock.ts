/** Injectable virtual clock. Every deadline in the app derives from clock.now(). */
type Listener = (now: Date) => void;

export class Clock {
  private offsetMs: number;
  private listeners = new Set<Listener>();
  constructor(offsetMs = 0, private readonly source: () => number = () => Date.now()) {
    this.offsetMs = offsetMs;
  }
  now(): Date { return new Date(this.source() + this.offsetMs); }
  advance(ms: number): void { this.offsetMs += ms; this.emit(); }
  advanceHours(h: number): void { this.advance(h * 3_600_000); }
  reset(): void { this.offsetMs = 0; this.emit(); }
  getOffset(): number { return this.offsetMs; }
  subscribe(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { const n = this.now(); this.listeners.forEach((l) => l(n)); }
}

export const clock = new Clock();

/** Locale-aware date/time in the configured timezone. */
export function formatDateTime(d: Date, locale: string, tz = "America/Monterrey"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d);
}
export function formatMXN(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "MXN" }).format(amount);
}
