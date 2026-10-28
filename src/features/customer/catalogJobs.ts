import catalogJson from "@/seed/pricing/catalog.json";
import type { Lang } from "@/core/config/fixx.config";
import { categories } from "./data";

interface NamedTask { id: string; category: string; job: string; jobEs?: string; jobKo?: string; keepCase?: Lang[] }
interface LaborRow { taskId: string; flag: string }

const catalog = catalogJson as { tasks: Record<string, NamedTask>; labor: Record<string, LaborRow> };
const tasks = Object.values(catalog.tasks);
const regulatedTasks = new Set(
  Object.values(catalog.labor).filter((row) => row.flag === "regulated").map((row) => row.taskId)
);

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

/** Catalog jobs for one home-screen trade, in task-id order. */
export function jobsForCategory(categoryId: string, lang: Lang): CatalogJob[] {
  const category = categories.find((c) => c.id === categoryId)?.catalogCategory;
  if (!category) return [];
  return tasks
    .filter((task) => task.category === category)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((task) => ({
      id: task.id,
      title: jobTitle(task, lang),
      keepCase: (task.keepCase ?? []).includes(lang),
      pendingReview: regulatedTasks.has(task.id)
    }));
}
