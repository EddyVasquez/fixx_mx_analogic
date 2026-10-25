import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import type { Recommendation } from "@/core/matching/recommend";
import { languageNames } from "@/i18n";
import { Button } from "@/ui/Button";
import { professionals } from "./data";

export function Recommendations({ recs, onChoose }: { recs: Recommendation[]; onChoose: (professionalId: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("recs.title")}</h2>
      {recs.length === 0 && <p>{t("recs.empty")}</p>}
      <ul className="flex flex-col gap-3">
        {recs.map((r) => {
          const p = professionals.find((x) => x.id === r.professionalId);
          if (!p) return null;
          return (
            <li key={p.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
              <p className="text-lg font-bold">{p.name}</p>
              {p.level && <p className="text-sm font-semibold">{t(`level.${p.level}`)}</p>}
              <p className="text-sm">{t("recs.speaks", { languages: p.languages.map((l) => languageNames[l as Lang]).join(", ") })}</p>
              <ul className="text-sm text-inkSoft">{r.reasons.map((x) => <li key={x}>{t(`reason.${x}`)}</li>)}</ul>
              <Button aria-label={`${t("btn.choose")}: ${p.name}`} onClick={() => onChoose(p.id)}>{t("btn.choose")}</Button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-inkSoft">{t("recs.verifiedNote")}</p>
    </div>
  );
}
