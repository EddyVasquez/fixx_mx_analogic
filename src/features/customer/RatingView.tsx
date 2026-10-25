import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";

export const DIMENSIONS = ["overall", "quality", "price", "communication", "professionalism", "punctuality", "wouldHire"] as const;
type Dim = (typeof DIMENSIONS)[number];

/** Customers rate professionals only, on 7 dimensions. Customer reliability is tracked internally and never shown. */
export function RatingView({ rated, warrantyEndsAt, onSubmit }: { rated: boolean; warrantyEndsAt: Date | null; onSubmit: (r: Record<Dim, number>) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [values, setValues] = useState<Partial<Record<Dim, number>>>({});
  const complete = DIMENSIONS.every((d) => (values[d] ?? 0) > 0);

  if (rated) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xl font-bold">{t("rating.thanks")}</p>
        {warrantyEndsAt && <p><DemoValue>{t("rating.warranty", { date: formatDateTime(warrantyEndsAt, localeFor[lang]) })}</DemoValue></p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("rating.title")}</h2>
      {DIMENSIONS.map((d) => (
        <fieldset key={d} className="flex flex-col gap-1">
          <legend className="font-semibold">{t(`rating.${d}`)}</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="relative">
                <input type="radio" name={d} value={n} className="peer sr-only" checked={values[d] === n} onChange={() => setValues({ ...values, [d]: n })} aria-label={t("rating.scale", { n })} />
                <span className="flex min-h-touch min-w-touch items-center justify-center rounded-full border-2 border-ink bg-paper font-bold peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-4 peer-focus-visible:ring-ink">{n}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Button disabled={!complete} onClick={() => onSubmit(values as Record<Dim, number>)}>{t("btn.sendRating")}</Button>
    </div>
  );
}
