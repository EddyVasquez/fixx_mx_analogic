import { z } from "zod";

const Lang = z.enum(["en", "es", "ko"]);
export const ZoneSchema = z.object({ id: z.string(), name: z.string(), adjacentTo: z.array(z.string()) });
export const CategorySchema = z.object({
  id: z.string(),
  names: z.object({ en: z.string(), es: z.string(), ko: z.string() }),
  lineType: z.enum(["perArea", "perPoint", "perVisit", "perItem"]) // TODO(decision P5): per-category itemization
});
export const UserSchema = z.object({
  id: z.string(), role: z.enum(["customer", "professional", "admin", "support"]), name: z.string(),
  language: Lang, phone: z.string(), email: z.string()
});
export const ProfessionalSchema = z.object({
  id: z.string(), userId: z.string(), name: z.string(), zoneId: z.string(),
  trades: z.array(z.string()).min(1), languages: z.array(Lang).min(1),
  verification: z.enum(["not_started", "pending", "approved", "rejected"]),
  level: z.enum(["verified", "pro", "expert"]).nullable(), qualityScore: z.number().min(0).max(100).nullable()
});
export const HomeSchema = z.object({
  id: z.string(), userId: z.string(), zoneId: z.string(), fraccionamiento: z.string(), address: z.string()
});
export type Zone = z.infer<typeof ZoneSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type User = z.infer<typeof UserSchema>;
export type Professional = z.infer<typeof ProfessionalSchema>;
export type Home = z.infer<typeof HomeSchema>;
