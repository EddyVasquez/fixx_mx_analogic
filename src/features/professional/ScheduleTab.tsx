import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { localeFor } from "@/i18n";
import { isFree, psession } from "./session";

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const SLOTS = ["morning", "afternoon"] as const;

/** Weekly availability. Customers only see times when the professional is free. */
export function ScheduleTab({ lang, rerender }: { lang: Lang; rerender: () => void }) {
  const { t } = useTranslation();
  const dayName = (dow: number) => new Intl.DateTimeFormat(localeFor[lang], { weekday: "long" }).format(new Date(Date.UTC(2026, 9, 4 + dow, 12)));
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("sched.title")}</h2>
      <p className="text-inkSoft">{t("sched.note")}</p>
      <ul className="flex flex-col gap-2">
        {DAYS.map((d) => (
          <li key={d} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-paper p-3">
            <span className="font-semibold">{dayName(d)}</span>
            <span className="flex gap-3">
              {SLOTS.map((s) => (
                <label key={s} className="flex min-h-touch items-center gap-2">
                  <input type="checkbox" className="h-6 w-6" checked={isFree(d, s)} aria-label={`${dayName(d)}: ${t(`sched.${s}`)}`}
                    onChange={(e) => { psession.availability[`${d}-${s}`] = e.target.checked; rerender(); }} />
                  {t(`sched.${s}`)}
                </label>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
