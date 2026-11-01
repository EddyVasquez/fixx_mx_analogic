import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "fixx.theme";
const listeners = new Set<() => void>();

let theme: Theme = "light";
let started = false;
let stopListening: (() => void) | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function savedTheme(): Theme | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    return null;
  }
  return null;
}

/** System preference when this browser has not chosen a theme yet. */
export function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function readTheme(): Theme {
  return savedTheme() ?? systemTheme();
}

function ensure(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  theme = readTheme();
  document.documentElement.dataset.theme = theme;
  const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (!mq) return;
  const onChange = () => {
    if (savedTheme()) return;
    theme = systemTheme();
    document.documentElement.dataset.theme = theme;
    emit();
  };
  mq.addEventListener?.("change", onChange);
  stopListening = () => mq.removeEventListener?.("change", onChange);
}

export function getTheme(): Theme {
  ensure();
  return theme;
}

/** Apply the saved or system theme before React paints. Clears the anti-flash inline color. */
export function initTheme(): void {
  ensure();
  if (typeof document === "undefined") return;
  document.documentElement.style.backgroundColor = "";
}

export function setTheme(next: Theme): void {
  ensure();
  theme = next;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
    document.documentElement.style.backgroundColor = "";
  }
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* quota or private mode */ }
  emit();
}

export function toggleTheme(): void {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}

/** Test helper. Forgets the saved choice and the in-memory theme. */
export function resetTheme(): void {
  stopListening?.();
  stopListening = null;
  started = false;
  theme = "light";
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  if (typeof document !== "undefined") {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.backgroundColor = "";
  }
  emit();
}
