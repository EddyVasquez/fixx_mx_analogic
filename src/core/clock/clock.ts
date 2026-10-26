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
/** Same pesos-and-centavos text in every language: "$1,250.00 MXN". The locale argument is kept for callers and is not used. */
export function formatMXN(amount: number, _locale?: string): string {
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `$${n} MXN`;
}
