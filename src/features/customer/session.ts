import type { PayMethod } from "@/core/rules";
import type { Lang } from "@/core/config/fixx.config";

export const JOB_ID = "job-customer";

/** Ratings customers gave professionals (kept for the professional's reputation view). Never shown to other customers as reliability data. */
export const ratings: { proId: string; values: Record<string, number> }[] = [];

export interface Draft {
  categoryId: string; description: string; photos: number; measurements: string;
  zoneId: string; // a zone id, or "outside"
  street: string; emergency: boolean;
}
export const emptyDraft = (): Draft => ({ categoryId: "painting", description: "", photos: 0, measurements: "", zoneId: "z1", street: "", emergency: false });

/** Flow state that must survive switching roles in the demo. Plain object; the screens re-render through the runtime. */
export const session = {
  signedIn: false, email: "", tab: "request" as "request" | "home" | "warranty" | "help", issueNote: "", draft: emptyDraft(), proId: null as string | null,
  method: "card" as PayMethod, slotHours: 30,
  /** Professionals the customer moved away from (cancelled, no-show, unanswered reschedule). */
  excluded: [] as string[],
  /** Additional work description written by the professional, in their language. */
  additionalNote: "", additionalLang: "es" as Lang,
  /** Optional customer ticks on the completion list. They do not gate approval. */
  completionChecks: {} as Record<string, boolean>
};
export function resetSession(keepSignIn = true): void {
  const { signedIn, email } = session;
  Object.assign(session, { signedIn: keepSignIn && signedIn, email: keepSignIn ? email : "", draft: emptyDraft(), proId: null, method: "card", slotHours: 30, excluded: [], additionalNote: "", additionalLang: "es", issueNote: "", tab: "request", completionChecks: {} });
}
