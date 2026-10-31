import { useSyncExternalStore } from "react";

const KEY = "fixx.profileAvatar";

export const AVATARS = [
  { id: "young-man", labelKey: "avatar.youngMan", badge: "lime" },
  { id: "young-woman", labelKey: "avatar.youngWoman", badge: "pink" },
  { id: "middle-man", labelKey: "avatar.middleMan", badge: "lime" },
  { id: "middle-woman", labelKey: "avatar.middleWoman", badge: "pink" },
  { id: "bald-man", labelKey: "avatar.baldMan", badge: "lime" },
  { id: "beard-glasses", labelKey: "avatar.beardedGlasses", badge: "lime" },
  { id: "long-hair", labelKey: "avatar.longHair", badge: "pink" },
  { id: "cap-man", labelKey: "avatar.cappedMan", badge: "lime" }
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];
export type AvatarBadge = (typeof AVATARS)[number]["badge"];

/** A middle-aged man. The demo homeowner is an adult, and this is easy to change. */
export const DEFAULT_AVATAR_ID: AvatarId = "middle-man";

const listeners = new Set<() => void>();

function known(id: string | null): id is AvatarId {
  return AVATARS.some((avatar) => avatar.id === id);
}

function readStored(): AvatarId {
  if (typeof localStorage === "undefined") return DEFAULT_AVATAR_ID;
  try {
    const value = localStorage.getItem(KEY);
    if (known(value)) return value;
  } catch { /* ignore */ }
  return DEFAULT_AVATAR_ID;
}

let current: AvatarId = readStored();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function avatarById(id: string): (typeof AVATARS)[number] {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS.find((avatar) => avatar.id === DEFAULT_AVATAR_ID)!;
}

export function getAvatarId(): AvatarId {
  return current;
}

export function setAvatar(id: string): void {
  current = known(id) ? id : DEFAULT_AVATAR_ID;
  try { localStorage.setItem(KEY, current); } catch { /* ignore */ }
  emit();
}

export function resetAvatar(): void {
  current = DEFAULT_AVATAR_ID;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}

export function subscribeAvatar(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAvatar(): AvatarId {
  return useSyncExternalStore(subscribeAvatar, getAvatarId, () => DEFAULT_AVATAR_ID);
}
