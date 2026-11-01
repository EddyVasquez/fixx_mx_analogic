import type { Lang } from "@/core/config/fixx.config";
import { jobsForCategory } from "./catalogJobs";
import { professionals } from "./data";

const DAY = 86_400_000;

/** A warranty with this many days left, or fewer, is marked expiring soon. */
export const EXPIRING_SOON_DAYS = 7;

export type DemoJobStatus = "scheduled" | "inProgress" | "pendingReview";

interface DemoJobSeed {
  id: string;
  categoryId: string;
  taskId: string;
  professionalId: string;
  status: DemoJobStatus;
  /** Customer price in MXN, including centavos. Never a payout or a margin. */
  total: number;
  progress: number;
  dayOffset: number;
}

/**
 * Sample jobs for the Santa Sofía home. Catalog task ids and the seeded professionals
 * are real records; the visits themselves are labeled samples, not live bookings.
 */
export const DEMO_JOB_SEEDS: readonly DemoJobSeed[] = [
  { id: "demo-plm", categoryId: "plumbing", taskId: "FIXX-PLM-001", professionalId: "p1", status: "scheduled", total: 780.5, progress: 25, dayOffset: 3 },
  { id: "demo-hvc", categoryId: "hvac", taskId: "FIXX-HVC-002", professionalId: "p1", status: "inProgress", total: 864.25, progress: 60, dayOffset: 0 },
  { id: "demo-pst", categoryId: "pest_control", taskId: "FIXX-PST-001", professionalId: "p4", status: "pendingReview", total: 1200.4, progress: 0, dayOffset: 6 }
];

export interface DemoJobView {
  id: string;
  categoryId: string;
  taskId: string;
  title: string;
  professionalId: string;
  professionalName: string;
  status: DemoJobStatus;
  total: number;
  progress: number;
  when: Date;
  pendingReview: boolean;
}

interface DemoWarrantySeed {
  id: string;
  categoryId: string;
  taskId: string;
  professionalId: string;
  daysLeft: number;
  claim: "none" | "inProgress";
}

export const DEMO_WARRANTY_SEEDS: readonly DemoWarrantySeed[] = [
  { id: "demo-w-pnt", categoryId: "painting", taskId: "FIXX-PNT-001", professionalId: "p2", daysLeft: 22, claim: "none" },
  { id: "demo-w-cln", categoryId: "cleaning", taskId: "FIXX-CLN-001", professionalId: "p4", daysLeft: 4, claim: "none" },
  { id: "demo-w-plm", categoryId: "plumbing", taskId: "FIXX-PLM-001", professionalId: "p1", daysLeft: 48, claim: "inProgress" }
];

export interface DemoWarrantyView {
  id: string;
  categoryId: string;
  taskId: string;
  title: string;
  professionalId: string;
  professionalName: string;
  daysLeft: number;
  endsAt: Date;
  expiringSoon: boolean;
  claimInProgress: boolean;
}

export function demoJobViews(now: Date, lang: Lang): DemoJobView[] {
  return DEMO_JOB_SEEDS.map((seed) => {
    const job = jobsForCategory(seed.categoryId, lang).find((item) => item.id === seed.taskId);
    const pro = professionals.find((item) => item.id === seed.professionalId);
    return {
      id: seed.id,
      categoryId: seed.categoryId,
      taskId: seed.taskId,
      title: job?.title ?? seed.taskId,
      professionalId: seed.professionalId,
      professionalName: pro?.name ?? "",
      status: seed.status,
      total: seed.total,
      progress: seed.progress,
      when: new Date(now.getTime() + seed.dayOffset * DAY),
      pendingReview: seed.status === "pendingReview" || Boolean(job?.pendingReview)
    };
  });
}

export function demoWarrantyViews(now: Date, lang: Lang): DemoWarrantyView[] {
  return DEMO_WARRANTY_SEEDS.map((seed) => {
    const job = jobsForCategory(seed.categoryId, lang).find((item) => item.id === seed.taskId);
    const pro = professionals.find((item) => item.id === seed.professionalId);
    return {
      id: seed.id,
      categoryId: seed.categoryId,
      taskId: seed.taskId,
      title: job?.title ?? seed.taskId,
      professionalId: seed.professionalId,
      professionalName: pro?.name ?? "",
      daysLeft: seed.daysLeft,
      endsAt: new Date(now.getTime() + seed.daysLeft * DAY),
      expiringSoon: seed.daysLeft <= EXPIRING_SOON_DAYS && seed.claim !== "inProgress",
      claimInProgress: seed.claim === "inProgress"
    };
  });
}
