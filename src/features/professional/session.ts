/** Professional-side demo state that survives switching roles. */
export const psession = {
  meId: null as string | null,
  tab: "jobs" as "jobs" | "schedule" | "profile" | "help",
  availability: {} as Record<string, boolean>,
  clabe: "", clabeSaved: false,
  idDoc: false, selfie: false, phoneVerified: false, recoverySelfie: false, recoveryPhone: false,
  before: 0, after: 0, checks: {} as Record<string, boolean>
};
/** Days are 0 = Sunday ... 6 = Saturday. Monday to Saturday are free by default. */
export const isFree = (dow: number, slot: "morning" | "afternoon"): boolean => psession.availability[`${dow}-${slot}`] ?? dow !== 0;
