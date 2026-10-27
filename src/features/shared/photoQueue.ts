import { config } from "@/core/config/fixx.config";

export type PhotoPhase = "before" | "after" | "problem";
export interface StampedPhoto {
  id: string;
  phase: PhotoPhase;
  takenAt: string;
  location: string;
  status: "queued" | "uploaded";
  attempts: number;
}

type Listener = () => void;

/**
 * Demo upload queue. Offline photos stay queued and upload on the next retry
 * once the connection (or the demo control) is back.
 */
export function createPhotoQueue(initialOnline = true) {
  let online = initialOnline;
  let seq = 1;
  const items: StampedPhoto[] = [];
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());
  const uploadQueued = () => {
    if (!online) return;
    for (const p of items) {
      if (p.status === "queued") {
        p.attempts += 1;
        p.status = "uploaded";
      }
    }
  };
  return {
    get items() { return items; },
    isOnline: () => online,
    subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setOnline(next: boolean) {
      online = next;
      if (online) uploadQueued();
      emit();
    },
    add(phase: PhotoPhase, takenAt: Date, location = config.completionCheck.demoLocation): StampedPhoto {
      const photo: StampedPhoto = {
        id: `ph-${seq++}`, phase, takenAt: takenAt.toISOString(), location, status: "queued", attempts: 0
      };
      items.push(photo);
      uploadQueued();
      emit();
      return photo;
    },
    /** Try again. Offline, the try is counted and the photo stays queued. */
    retry() {
      for (const p of items) if (p.status === "queued") p.attempts += 1;
      uploadQueued();
      emit();
    },
    count(phase: PhotoPhase, includeQueued = true) {
      return items.filter((p) => p.phase === phase && (includeQueued || p.status === "uploaded")).length;
    },
    reset() {
      items.splice(0, items.length);
      seq = 1;
      online = true;
      emit();
    }
  };
}

export const photoQueue = createPhotoQueue(typeof navigator === "undefined" ? true : navigator.onLine);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (!photoQueue.isOnline()) photoQueue.setOnline(true); });
  window.addEventListener("offline", () => photoQueue.setOnline(false));
}
