import catalogJson from "@/seed/pricing/catalog.json";
import type { Lang } from "@/core/config/fixx.config";
import { categories } from "./data";

interface NamedTask { id: string; category: string; job: string; jobEs?: string; jobKo?: string }

const tasks = Object.values((catalogJson as { tasks: Record<string, NamedTask> }).tasks);

/** Job title in the language the customer is using. Korean falls back to Spanish, then English. */
export function jobTitle(task: NamedTask, lang: Lang): string {
  if (lang === "ko") return task.jobKo || task.jobEs || task.job;
  if (lang === "es") return task.jobEs || task.job;
  return task.job;
}

/** Catalog jobs for one home-screen trade, in task-id order. */
export function jobsForCategory(categoryId: string, lang: Lang): { id: string; title: string }[] {
  const category = categories.find((c) => c.id === categoryId)?.catalogCategory;
  if (!category) return [];
  return tasks
    .filter((task) => task.category === category)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((task) => ({ id: task.id, title: jobTitle(task, lang) }));
}
