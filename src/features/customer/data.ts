import zonesJson from "@/seed/zones.json";
import categoriesJson from "@/seed/categories.json";
import prosJson from "@/seed/professionals.json";
import usersJson from "@/seed/users.json";
import homesJson from "@/seed/homes.json";
import type { ProLike, ZoneLike } from "@/core/matching/recommend";
import type { Category } from "@/core/types/seed";

export const zones: ZoneLike[] = zonesJson;
export const zoneNames: Record<string, string> = Object.fromEntries(zonesJson.map((z) => [z.id, z.name]));
export const categories = categoriesJson as Category[];
export const professionals = prosJson as ProLike[];
export const homes = homesJson;
export const customers = usersJson.filter((u) => u.role === "customer");
