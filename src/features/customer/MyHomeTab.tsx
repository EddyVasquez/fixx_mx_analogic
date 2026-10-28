import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { JobCtx, JobState } from "@/core/machines";
import { localeFor } from "@/i18n";
import { useRuntime } from "@/demo/runtime";
import { useMoney } from "@/features/shared/Money";
import { categories, professionals } from "./data";
import { formatArea, type HomeModel } from "./homeModel";
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
      {profile.model && <HomeModelCard model={profile.model} lang={lang} />}
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

function HomeModelCard({ model, lang }: { model: HomeModel; lang: Lang }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4" aria-labelledby="home-model-heading">
      {lang === "ko" && <p className="text-sm font-semibold">{t("myhome.translationDraft")}</p>}
      <h3 id="home-model-heading" className="text-lg font-bold">{t("myhome.model.santaSofia")}</h3>
      <p>{t("myhome.source")}</p>
      <p>{t("myhome.stories", { count: model.stories })}</p>
      <p>{model.lotApproximate ? t("myhome.lotAbout", { area: formatArea(model.lotM2) }) : t("myhome.lot", { area: formatArea(model.lotM2) })}</p>
      <p>{t("myhome.built", { area: formatArea(model.builtM2) })}</p>
      <h4 className="font-bold">{t("myhome.ground")}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>{t("myhome.garage", { min: model.garageCarsMin, max: model.garageCarsMax })}</li>
        {model.livingDining && <li>{t("myhome.livingDining")}</li>}
        {model.kitchen && <li>{t("myhome.kitchen")}</li>}
        {model.kitchenBuiltIn !== "none" && <li>{t(`myhome.kitchenBuiltIn.${model.kitchenBuiltIn}`)}</li>}
        {model.breakfastBar !== "none" && <li>{t(`myhome.breakfastBar.${model.breakfastBar}`)}</li>}
        <li>{t("myhome.fullBathrooms", { count: model.groundFullBathrooms })}</li>
        {model.laundry && <li>{t("myhome.laundry")}</li>}
        {model.backPatio && <li>{t("myhome.backPatio")}</li>}
        {model.sidePassage && <li>{t("myhome.sidePassage")}</li>}
      </ul>
      <h4 className="font-bold">{t("myhome.upper")}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>{t("myhome.bedrooms", { count: model.bedrooms })}</li>
        {model.mainBedroomCloset && model.mainBedroomMinisplit && <li>{t("myhome.mainBedroom")}</li>}
        {model.mainBedroomCloset && !model.mainBedroomMinisplit && <li>{t("myhome.mainBedroomCloset")}</li>}
        {!model.mainBedroomCloset && model.mainBedroomMinisplit && <li>{t("myhome.mainBedroomMinisplit")}</li>}
        <li>{t("myhome.sharedBathroom", { count: model.upperFullBathrooms })}</li>
      </ul>
      {model.plansVaryByPhase && <p className="text-sm">{t("myhome.plansVary")}</p>}
    </section>
  );
}
