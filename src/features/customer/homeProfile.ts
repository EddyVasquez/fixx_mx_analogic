import { useSyncExternalStore } from "react";
import { z } from "zod";
import demoProfileSeed from "@/seed/demoProfile.json";
import { HomeModelSchema } from "./homeModel";

/** One homeowner profile. A future registration flow replaces this with the signed-in person's own data. */
export const HomeProfileSchema = z.object({
  homeownerName: z.string().min(1),
  community: z.string().min(1),
  address: z.string().min(1),
  /** Builder floor plan, when this profile was started from a home preset. */
  model: HomeModelSchema.optional()
});
export type HomeProfile = z.infer<typeof HomeProfileSchema>;

const demoProfile = HomeProfileSchema.parse(demoProfileSeed);

let current: HomeProfile = demoProfile;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getHomeProfile(): HomeProfile {
  return current;
}

/** Registration will call this with the signed-in homeowner's own profile. */
export function setHomeProfile(next: HomeProfile): void {
  current = HomeProfileSchema.parse(next);
  emit();
}

export function resetHomeProfile(): void {
  current = demoProfile;
  emit();
}

export function subscribeHomeProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useHomeProfile(): HomeProfile {
  return useSyncExternalStore(subscribeHomeProfile, getHomeProfile, getHomeProfile);
}
