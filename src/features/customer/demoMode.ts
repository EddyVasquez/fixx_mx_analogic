import { useSyncExternalStore } from "react";

const KEY = "fixx.demoMode";
const listeners = new Set<() => void>();

function readStored(): boolean | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(KEY);
    if (value === "0") return false;
    if (value === "1") return true;
  } catch {
    return null;
  }
  return null;
}

/** On unless this browser has turned sample data off. The demo build starts with it on. */
let enabled = readStored() ?? true;

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function isDemoMode(): boolean {
  return enabled;
}

export function setDemoMode(next: boolean): void {
  enabled = next;
  try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore quota or private mode */ }
  emit();
}

/** Forget the saved choice so the demo build default (on) applies again. */
export function resetDemoMode(): void {
  enabled = true;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}

export function subscribeDemoMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribeDemoMode, isDemoMode, () => true);
}
