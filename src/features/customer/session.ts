import type { PayMethod } from "@/core/rules";
import type { Lang } from "@/core/config/fixx.config";
import { blankQuoteFacts, quoteFactsFromModel } from "./homeModel";
import { getHomeProfile } from "./homeProfile";

export const JOB_ID = "job-customer";

/** Customer section tabs. My Home is the landing tab; Help stays after Warranty. */
export const CUSTOMER_TAB_ORDER = ["home", "request", "warranty", "help"] as const;
export type CustomerTab = (typeof CUSTOMER_TAB_ORDER)[number];

/** Ratings customers gave professionals (kept for the professional's reputation view). Never shown to other customers as reliability data. */
export const ratings: { proId: string; values: Record<string, number> }[] = [];

export interface Draft {
  categoryId: string; description: string; photos: number; measurements: string;
  zoneId: string; // a zone id, or "outside"
  /** Copied from the home profile when a request starts. Edits apply to this request only. */
  homeownerName: string; community: string; street: string; emergency: boolean;
  /** Copied from the home model. Cleaning size is a catalog m² band. The customer can change each one. */
  cleaningTier: string; minisplits: number; bathrooms: number; bedrooms: number;
  /** Catalog task ids, in the order the customer selected them. */
  selectedJobIds: string[];
  /** True after the customer types in the description. Chip changes no longer overwrite it. */
  descriptionEdited: boolean;
}
export const emptyDraft = (over: Partial<Draft> = {}): Draft => {
  const profile = getHomeProfile();
  const facts = profile.model ? quoteFactsFromModel(profile.model) : blankQuoteFacts();
  return {
    categoryId: "painting", description: "", photos: 0, measurements: "", zoneId: "z1",
    homeownerName: profile.homeownerName, community: profile.community, street: profile.address, emergency: false,
    ...facts,
    selectedJobIds: [], descriptionEdited: false,
    ...over
  };
};

/** Flow state that must survive switching roles in the demo. Plain object; the screens re-render through the runtime. */
export const session = {
  signedIn: false, email: "", tab: "home" as CustomerTab, issueNote: "", draft: emptyDraft(), proId: null as string | null,
  method: "card" as PayMethod, slotHours: 30,
  /** Professionals the customer moved away from (cancelled, no-show, unanswered reschedule). */
  excluded: [] as string[],
  /** Additional work description written by the professional, in their language. */
  additionalNote: "", additionalLang: "es" as Lang,
  /** Optional customer ticks on the completion list. They do not gate approval. */
  completionChecks: {} as Record<string, boolean>,
  /** When true, the Request tab opens the form with the draft category instead of the service list. */
  openBuilder: false
};
export function resetSession(keepSignIn = true): void {
  const { signedIn, email } = session;
  Object.assign(session, { signedIn: keepSignIn && signedIn, email: keepSignIn ? email : "", draft: emptyDraft(), proId: null, method: "card", slotHours: 30, excluded: [], additionalNote: "", additionalLang: "es", issueNote: "", tab: "home", completionChecks: {}, openBuilder: false });
}
