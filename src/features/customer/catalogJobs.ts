import catalogJson from "@/seed/pricing/catalog.json";
import type { Lang } from "@/core/config/fixx.config";
import { isPendingQuotes } from "@/core/pricing/reviewStatus";
import { buildJobSentence } from "./jobSentence";
import { categories } from "./data";

interface NamedLine { reviewTrigger?: string }
interface NamedTask { id: string; category: string; job: string; jobEs?: string; jobKo?: string; keepCase?: Lang[]; lines?: NamedLine[] }
interface LaborRow { taskId: string; flag: string; reviewStatus?: string | null }

const catalog = catalogJson as { tasks: Record<string, NamedTask>; labor: Record<string, LaborRow> };
const tasks = Object.values(catalog.tasks);
const reviewTasks = new Set([
  ...Object.values(catalog.labor)
    .filter((row) => row.flag === "regulated" || isPendingQuotes(row.flag, row.reviewStatus))
    .map((row) => row.taskId),
  ...tasks.filter((task) => (task.lines ?? []).some((line) => line.reviewTrigger === "base")).map((task) => task.id)
]);

export interface CatalogJob {
  id: string;
  title: string;
  /** The label starts with a proper noun or an acronym in this language. */
  keepCase: boolean;
  /** Regulated work still has to be reviewed before it can be booked. */
  pendingReview: boolean;
}

/** Job title in the language the customer is using. Korean falls back to Spanish, then English. */
export function jobTitle(task: NamedTask, lang: Lang): string {
  if (lang === "ko") return task.jobKo || task.jobEs || task.job;
  if (lang === "es") return task.jobEs || task.job;
  return task.job;
}

export interface CatalogJobRecord {
  id: string;
  categoryId: string;
  titles: Record<Lang, string>;
  keepCase: Lang[];
  /** Regulated work still has to be reviewed before it can be booked. */
  pendingReview: boolean;
}

const categoryIdByCatalog = new Map(categories.map((category) => [category.catalogCategory, category.id]));

/** Every catalog job that belongs to a home-screen trade. Search, chips and the job list all read this. */
export function catalogJobRecords(): CatalogJobRecord[] {
  return tasks.flatMap((task) => {
    const categoryId = categoryIdByCatalog.get(task.category);
    if (!categoryId) return [];
    return [{
      id: task.id,
      categoryId,
      titles: { en: jobTitle(task, "en"), es: jobTitle(task, "es"), ko: jobTitle(task, "ko") },
      keepCase: task.keepCase ?? [],
      pendingReview: reviewTasks.has(task.id)
    }];
  });
}

/** Catalog jobs for one home-screen trade, in task-id order. */
export function jobsForCategory(categoryId: string, lang: Lang): CatalogJob[] {
  return catalogJobRecords()
    .filter((job) => job.categoryId === categoryId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((job) => ({
      id: job.id,
      title: job.titles[lang],
      keepCase: job.keepCase.includes(lang),
      pendingReview: job.pendingReview
    }));
}

/** The same sentence the request form writes when those jobs are selected. */
export function descriptionForJobs(categoryId: string, lang: Lang, ids: readonly string[]): string {
  const byId = new Map(jobsForCategory(categoryId, lang).map((job) => [job.id, job]));
  const ordered = ids.flatMap((id) => {
    const job = byId.get(id);
    return job ? [job] : [];
  });
  return buildJobSentence(ordered.map((job) => ({ label: job.title, keepCase: job.keepCase })), lang);
}
