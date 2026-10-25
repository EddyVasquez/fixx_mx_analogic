export interface TimerItem { id: number; actorId: string; at: Date; event: { type: string }; label: string }

/** Pending timers for the demo. Fast-forwarding the virtual clock fires whatever became due, in time order. */
export class Scheduler {
  private items: TimerItem[] = [];
  private seq = 1;
  /** Adding the same actor + event + time twice is a no-op. */
  add(actorId: string, at: Date, event: { type: string }, label: string): boolean {
    if (this.items.some((i) => i.actorId === actorId && i.event.type === event.type && i.at.getTime() === at.getTime())) return false;
    this.items.push({ id: this.seq++, actorId, at, event, label });
    return true;
  }
  cancel(pred: (t: TimerItem) => boolean): number {
    const before = this.items.length;
    this.items = this.items.filter((i) => !pred(i));
    return before - this.items.length;
  }
  list(actorId?: string): TimerItem[] {
    return this.items.filter((i) => !actorId || i.actorId === actorId).sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
  }
  /** Removes and returns the earliest timer due at or before `now`. */
  takeNextDue(now: Date): TimerItem | null {
    const next = this.list()[0];
    if (!next || next.at.getTime() > now.getTime()) return null;
    this.items = this.items.filter((i) => i.id !== next.id);
    return next;
  }
  clear(): void { this.items = []; }
}
