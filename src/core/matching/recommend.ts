import { config } from "../config/fixx.config";

export interface ProLike {
  id: string; name: string; zoneId: string; trades: string[]; languages: string[];
  verification: string; level: string | null; qualityScore: number | null;
}
export interface ZoneLike { id: string; adjacentTo: readonly string[] }
export type Reason = "sameZone" | "nearby" | "speaksYourLanguage" | "topQuality";
export interface Recommendation { professionalId: string; score: number; reasons: Reason[] }

/**
 * 2-3 recommended professionals: must do the trade and have approved verification.
 * Score = config weights for same/adjacent zone, language match and Quality Score (decision G7).
 */
export function recommend(
  i: { categoryId: string; customerZoneId: string | null; customerLang: string; professionals: readonly ProLike[]; zones: readonly ZoneLike[] },
  cfg: typeof config = config
): Recommendation[] {
  const w = cfg.matching;
  return i.professionals
    .filter((p) => p.verification === "approved" && p.trades.includes(i.categoryId))
    .map((p): Recommendation & { name: string } => {
      const reasons: Reason[] = [];
      let score = 0;
      if (i.customerZoneId && p.zoneId === i.customerZoneId) { score += w.sameZone; reasons.push("sameZone"); }
      else if (i.customerZoneId && i.zones.find((z) => z.id === p.zoneId)?.adjacentTo.includes(i.customerZoneId)) { score += w.nearby; reasons.push("nearby"); }
      if (p.languages.includes(i.customerLang)) { score += w.language; reasons.push("speaksYourLanguage"); }
      if ((p.qualityScore ?? 0) >= w.topQualityScore) reasons.push("topQuality");
      score += (p.qualityScore ?? 0) * w.qualityPerPoint;
      return { professionalId: p.id, score, reasons, name: p.name };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, w.maxRecommendations)
    .map(({ professionalId, score, reasons }) => ({ professionalId, score, reasons }));
}
