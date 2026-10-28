import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { JobCtx, JobState } from "@/core/machines";
import { localeFor } from "@/i18n";
import { useRuntime } from "@/demo/runtime";
import { useMoney } from "@/features/shared/Money";
import { categories, professionals } from "./data";
import { useHomeProfile } from "./homeProfile";
import { JOB_ID, session } from "./session";

const DONE: JobState[] = ["paymentReleased", "rated"];

/** Home profile and service history. The profile comes from the home profile store. */
export function MyHomeTab({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const money = useMoney();
  const profile = useHomeProfile();
  const job = rt.get(JOB_ID);
  const state = job?.snap.state as JobState | undefined;
  const ctx = job?.snap.ctx as JobCtx | undefined;
  const doneAt = job?.snap.history.find((h) => h.event === "MARK_COMPLETE")?.at;
  const category = categories.find((c) => c.id === session.draft.categoryId);
  const pro = professionals.find((p) => p.id === session.proId);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("myhome.title")}</h2>
      <section className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-4">
        <p className="font-bold">{t("myhome.homeowner", { name: profile.homeownerName })}</p>
        <p className="font-bold">{t("myhome.community", { name: profile.community })}</p>
        <p>{t("myhome.address", { address: profile.address })}</p>
      </section>
      <h3 className="text-lg font-bold">{t("myhome.history")}</h3>
      {state && ctx && DONE.includes(state) ? (
        <ul className="flex flex-col gap-2">
          <li className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-4">
            <p className="font-bold">{t("myhome.entry", { category: category?.names[lang] ?? "", professional: pro?.name ?? "" })}</p>
            {doneAt && <p className="text-sm">{t("myhome.completed", { date: formatDateTime(new Date(doneAt), localeFor[lang]) })}</p>}
            <p>{t("myhome.total", { amount: money(ctx.total) })}</p>
          </li>
        </ul>
      ) : <p className="rounded-2xl border border-line bg-paper p-4">{t("myhome.noHistory")}</p>}
    </div>
  );
}
