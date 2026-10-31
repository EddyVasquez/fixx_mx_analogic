import { useTranslation } from "react-i18next";
import { Bathtub } from "@phosphor-icons/react/Bathtub";
import { Bed } from "@phosphor-icons/react/Bed";
import { Broom } from "@phosphor-icons/react/Broom";
import { Car } from "@phosphor-icons/react/Car";
import { Drop } from "@phosphor-icons/react/Drop";
import { Fan } from "@phosphor-icons/react/Fan";
import { Hammer } from "@phosphor-icons/react/Hammer";
import { Key } from "@phosphor-icons/react/Key";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { Ruler } from "@phosphor-icons/react/Ruler";
import { Snowflake } from "@phosphor-icons/react/Snowflake";
import { Stairs } from "@phosphor-icons/react/Stairs";
import type { Icon } from "@phosphor-icons/react";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { JobState, WarrantyCtx, WarrantyState } from "@/core/machines";
import { localeFor } from "@/i18n";
import { useRuntime } from "@/demo/runtime";
import { stateLabel } from "@/features/admin/sections";
import { useMoney } from "@/features/shared/Money";
import { Button } from "@/ui/Button";
import { colors } from "@/ui/tokens";
import { BlueprintSlot } from "./blueprint/BlueprintSlot";
import { categories, professionals } from "./data";
import { formatArea, type HomeModel } from "./homeModel";
import { useHomeProfile } from "./homeProfile";
import { JOB_ID, session } from "./session";

const DONE: JobState[] = ["paymentReleased", "rated"];

const SHORTCUTS: { id: string; Icon: Icon }[] = [
  { id: "plumbing", Icon: Drop },
  { id: "electrical", Icon: Lightning },
  { id: "hvac", Icon: Fan },
  { id: "cleaning", Icon: Broom },
  { id: "handyman", Icon: Hammer },
  { id: "locksmith", Icon: Key }
];

const MAINTENANCE: { key: string; categoryId: string }[] = [
  { key: "myhome.hub.maint.filters", categoryId: "hvac" },
  { key: "myhome.hub.maint.heater", categoryId: "plumbing" },
  { key: "myhome.hub.maint.pest", categoryId: "pest_control" }
];

const WARRANTY_CHIP: Record<WarrantyState, string> = {
  running: "myhome.hub.warrantyState.active",
  claimFiled: "myhome.hub.warrantyState.claimFiled",
  inReview: "myhome.hub.warrantyState.inReview",
  expired: "myhome.hub.warrantyState.expired"
};

/** Phone order. Wider layouts place these with explicit columns so focus stays in this order. */
const PLACE = {
  hero: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-1 lg:col-span-8 lg:col-start-1 lg:row-start-1",
  active: "col-span-1 md:col-span-3 md:col-start-1 md:row-start-2 lg:col-span-4 lg:col-start-9 lg:row-start-1",
  quick: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-3 lg:col-span-8 lg:col-start-1 lg:row-start-2",
  warranty: "col-span-1 md:col-span-3 md:col-start-4 md:row-start-2 lg:col-span-4 lg:col-start-9 lg:row-start-2",
  maintenance: "col-span-1 md:col-span-3 md:col-start-1 md:row-start-4 lg:col-span-6 lg:col-start-1 lg:row-start-3",
  documents: "col-span-1 md:col-span-3 md:col-start-4 md:row-start-4 lg:col-span-6 lg:col-start-7 lg:row-start-3",
  details: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-5 lg:col-span-8 lg:col-start-1 lg:row-start-4",
  history: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-6 lg:col-span-4 lg:col-start-9 lg:row-start-4"
} as const;

const card = "flex min-w-0 flex-col gap-3 self-stretch rounded-[20px] border border-line bg-paper p-4 shadow-[0_8px_24px_rgba(46,46,46,0.08)] md:p-6";

interface JobView {
  total: number;
  initialDue: number;
  paid: number;
  jobStart: Date;
  onTheWayAt: Date | null;
  professionalId: string | null;
}

function formatClockTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "America/Monterrey" }).format(d);
}

function priced(ctx: JobView): { key: "myhome.hub.due" | "myhome.total"; amount: number } | null {
  if (ctx.initialDue > 0 && ctx.paid < ctx.initialDue) return { key: "myhome.hub.due", amount: Math.max(ctx.initialDue - ctx.paid, 0) };
  if (ctx.total > 0) return { key: "myhome.total", amount: ctx.total };
  return null;
}

function nextMoment(ctx: JobView): Date | null {
  if (ctx.onTheWayAt) return new Date(ctx.onTheWayAt);
  const start = ctx.jobStart ? new Date(ctx.jobStart) : null;
  if (start && start.getTime() > 0) return start;
  return null;
}

function warrantyDays(endsAt: Date, now: Date): number {
  return Math.max(Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000), 0);
}

function warrantyRatio(startsAt: Date, endsAt: Date, now: Date): number {
  const span = endsAt.getTime() - startsAt.getTime();
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - startsAt.getTime()) / span));
}

function ExampleTag() {
  const { t } = useTranslation();
  return <span className="inline-flex items-center rounded bg-warnBg px-1.5 py-0.5 text-xs font-semibold text-warnInk">{t("myhome.hub.example")}</span>;
}

/** Tablet-first home hub. Real modules use runtime and profile data. Maintenance and documents are examples. */
export function MyHomeTab({ lang, onNavigate }: { lang: Lang; onNavigate: () => void }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const money = useMoney();
  const profile = useHomeProfile();
  const model = profile.model;
  const job = rt.get(JOB_ID);
  const state = job?.snap.state as JobState | undefined;
  const ctx = job?.snap.ctx as JobView | undefined;
  const active = state && ctx && !DONE.includes(state) ? { state, ctx } : null;
  const warrantyActor = rt.get(`warranty:${JOB_ID}`);
  const now = rt.clock.now();
  const locale = localeFor[lang];

  const openRequest = (categoryId: string | null) => {
    if (categoryId) {
      session.draft = { ...session.draft, categoryId, emergency: false, selectedJobIds: [], description: "", descriptionEdited: false };
      session.openBuilder = true;
    } else session.openBuilder = false;
    session.tab = "request";
    onNavigate();
  };

  const openWarranty = () => {
    session.tab = "warranty";
    onNavigate();
  };

  const shortcuts = SHORTCUTS.flatMap((item) => {
    const category = categories.find((c) => c.id === item.id);
    return category ? [{ ...item, name: category.names[lang] }] : [];
  });

  return (
    <div data-testid="home-hub" className="grid grid-cols-1 items-stretch gap-4 text-[16px] leading-6 text-ink md:grid-cols-6 md:gap-6 lg:grid-cols-12">
      <section aria-labelledby="home-hero-name" data-module="hero" className={`${PLACE.hero} flex min-w-0 flex-col self-stretch rounded-[20px] border border-line bg-accent p-3 shadow-[0_8px_24px_rgba(46,46,46,0.08)] md:p-4`}>
        {model && (
          <div className="relative h-[240px] overflow-hidden rounded-2xl border border-line bg-white md:h-[320px] lg:h-[360px]">
            {/* The name card overlaps this strip, so the model is framed in the visible part. */}
            <div className="absolute inset-x-0 top-0 bottom-8 md:bottom-12">
              <BlueprintSlot label={t("myhome.hub.blueprint")} />
            </div>
          </div>
        )}
        <div className={`relative z-10 flex flex-col gap-4 rounded-[20px] border border-line bg-paper p-4 shadow-[0_8px_24px_rgba(46,46,46,0.08)] md:p-6 ${model ? "-mt-8 md:-mt-12" : ""}`}>
          {lang === "ko" && <p className="font-semibold">{t("myhome.translationDraft")}</p>}
          <div className="flex flex-col gap-1">
            <h1 id="home-hero-name" className="break-words text-[24px] font-bold leading-tight md:text-[32px]">{profile.homeownerName}</h1>
            <p className="break-words">{t("myhome.community", { name: profile.community })}</p>
            <p className="break-words">{t("myhome.address", { address: profile.address })}</p>
            {model && <p className="break-words font-semibold">{t("myhome.hub.modelLine", { model: t("myhome.model.santaSofia"), developer: model.developer })}</p>}
            <p className="text-inkSoft">{t("myhome.hub.updated", { time: formatClockTime(now, locale) })}</p>
          </div>
          {model && <StatTiles model={model} />}
        </div>
      </section>

      <ActiveJob lang={lang} active={active} onView={() => openRequest(null)} onRequest={() => openRequest(null)} />

      <section aria-labelledby="hub-quick" data-module="quick" className={`${card} ${PLACE.quick}`}>
        <h2 id="hub-quick" className="text-[22px] font-bold leading-tight">{t("myhome.hub.quick")}</h2>
        <ul className="grid grid-cols-3 gap-3">
          {shortcuts.map((item) => {
            const selected = session.draft.categoryId === item.id;
            const ShortcutIcon = item.Icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => openRequest(item.id)}
                  className={`flex min-h-touch w-full flex-col items-center justify-center gap-1 rounded-[20px] border border-line px-2 py-2 text-center text-ink ${selected ? "bg-accent" : "bg-paper"}`}
                >
                  <ShortcutIcon aria-hidden="true" size={24} weight="bold" color={colors.ink} />
                  <span className="break-words leading-tight">{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <a href="#request" className="inline-flex min-h-touch items-center font-semibold underline" onClick={(e) => { e.preventDefault(); openRequest(null); }}>
          {t("myhome.hub.allServices")}
        </a>
      </section>

      <WarrantyCard lang={lang} actor={warrantyActor} now={now} onOpen={openWarranty} />

      <section aria-labelledby="hub-maintenance" data-module="maintenance" className={`${card} ${PLACE.maintenance}`}>
        <h2 id="hub-maintenance" className="text-[22px] font-bold leading-tight">{t("myhome.hub.maintenance")}</h2>
        <p className="break-words">{t("myhome.hub.exampleNote")}</p>
        <ul className="flex flex-col gap-3">
          {MAINTENANCE.map((item) => (
            <li key={item.key}>
              <button type="button" onClick={() => openRequest(item.categoryId)} className="flex min-h-touch w-full flex-col items-start justify-center gap-1 rounded-2xl border border-line bg-paper px-3 py-2 text-left">
                <ExampleTag />
                <span className="break-words">{t(item.key)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {model && (
        <section aria-labelledby="hub-rooms" data-module="details" className={`${card} ${PLACE.details}`}>
          <details open>
            <summary className="min-h-touch cursor-pointer py-2">
              <h2 id="hub-rooms" className="inline text-[22px] font-bold leading-tight">{t("myhome.hub.rooms")}</h2>
            </summary>
            <HomeModelCard model={model} />
          </details>
        </section>
      )}

      <HistoryCard lang={lang} state={state} ctx={ctx} />

      <section aria-labelledby="hub-documents" data-module="documents" className={`${card} ${PLACE.documents}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="hub-documents" className="text-[22px] font-bold leading-tight">{t("myhome.hub.documents")}</h2>
          <ExampleTag />
        </div>
        <p className="break-words">{t("myhome.hub.exampleNote")}</p>
        <p className="break-words">{t("myhome.hub.docsEmpty")}</p>
      </section>
    </div>
  );
}

function StatTiles({ model }: { model: HomeModel }) {
  const { t } = useTranslation();
  const bathrooms = model.groundFullBathrooms + model.upperFullBathrooms;
  const tiles: { id: string; label: string; value: string; Icon: Icon }[] = [
    { id: "stories", label: t("myhome.hub.stat.stories"), value: String(model.stories), Icon: Stairs },
    { id: "built", label: t("myhome.hub.stat.built"), value: t("myhome.hub.areaValue", { area: formatArea(model.builtM2) }), Icon: Ruler },
    { id: "bedrooms", label: t("myhome.hub.stat.bedrooms"), value: String(model.bedrooms), Icon: Bed },
    { id: "bathrooms", label: t("myhome.hub.stat.bathrooms"), value: String(bathrooms), Icon: Bathtub },
    { id: "minisplits", label: t("myhome.hub.stat.minisplits"), value: String(model.minisplits), Icon: Snowflake },
    { id: "garage", label: t("myhome.hub.stat.garage"), value: t("myhome.hub.span", { min: model.garageCarsMin, max: model.garageCarsMax }), Icon: Car }
  ];
  return (
    <dl className="grid grid-cols-3 gap-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.id} className="min-w-0 rounded-2xl bg-accent px-2 py-3 text-ink">
          <dt className="flex items-center gap-2 break-words leading-tight">
            <tile.Icon aria-hidden="true" size={22} weight="bold" color={colors.ink} />
            <span>{tile.label}</span>
          </dt>
          <dd className="mt-1 text-[22px] font-semibold leading-tight">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActiveJob({ lang, active, onView, onRequest }: {
  lang: Lang;
  active: { state: JobState; ctx: JobView } | null;
  onView: () => void;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const category = categories.find((c) => c.id === session.draft.categoryId);
  const proId = active?.ctx.professionalId ?? session.proId;
  const pro = professionals.find((p) => p.id === proId);
  const price = active ? priced(active.ctx) : null;
  const when = active ? nextMoment(active.ctx) : null;
  const statusText = active ? stateLabel(t, active.state) : t("myhome.hub.noActive");

  return (
    <section aria-labelledby="hub-active" data-module="active" className={`${card} ${PLACE.active}`}>
      <h2 id="hub-active" className="text-[22px] font-bold leading-tight">{t("myhome.hub.activeJob")}</h2>
      {active ? (
        <div className="flex flex-1 flex-col gap-2">
          <p className="break-words font-semibold">
            {pro
              ? t("myhome.entry", { category: category?.names[lang] ?? "", professional: pro.name })
              : (category?.names[lang] ?? "")}
          </p>
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-accent" />
            {active.state === "pendingReview" ? (
              <p aria-live="polite" className="min-w-0 break-words rounded-full bg-warnAmberBg px-3 py-1 font-semibold text-warnAmberInk">{t("review.pending.title")}</p>
            ) : (
              <p aria-live="polite" className="min-w-0 break-words">{statusText}</p>
            )}
          </div>
          {when && <p className="break-words">{t("myhome.hub.next", { date: formatDateTime(when, localeFor[lang]) })}</p>}
          {price && <p className="break-words">{t(price.key, { amount: money(price.amount) })}</p>}
          <div className="mt-auto pt-2">
            <Button onClick={onView}>{t("myhome.hub.viewJob")}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <p aria-live="polite" className="break-words">{t("myhome.hub.noActive")}</p>
          <div className="mt-auto">
            <Button onClick={onRequest}>{t("customer.tab.request")}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function WarrantyCard({ lang, actor, now, onOpen }: {
  lang: Lang;
  actor: ReturnType<ReturnType<typeof useRuntime>["get"]>;
  now: Date;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = actor?.snap.ctx as WarrantyCtx | undefined;
  const st = actor?.snap.state as WarrantyState | undefined;
  const days = c ? warrantyDays(c.endsAt, now) : 0;
  const ratio = c ? warrantyRatio(c.startsAt, c.endsAt, now) : 0;
  const percent = Math.round(ratio * 100);
  return (
    <section aria-labelledby="hub-warranty" data-module="warranty" className={`${card} ${PLACE.warranty}`}>
      <h2 id="hub-warranty" className="text-[22px] font-bold leading-tight">{t("myhome.hub.warranty")}</h2>
      {c && st ? (
        <div className="flex flex-1 flex-col gap-3">
          <p className="inline-flex w-fit max-w-full items-center break-words rounded-full border border-line bg-mist px-3 py-1 font-semibold">{t(WARRANTY_CHIP[st])}</p>
          <p className="break-words">{t("myhome.hub.daysLeft", { n: days })}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={t("myhome.hub.warranty")}
            className="h-1.5 w-full overflow-hidden rounded-full bg-mist"
          >
            <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-auto pt-2">
            <Button variant="secondary" onClick={onOpen}>{t("myhome.hub.openWarranty")}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <p className="break-words">{t("myhome.hub.noWarranty")}</p>
          <div className="mt-auto pt-2">
            <Button variant="secondary" onClick={onOpen}>{t("myhome.hub.openWarranty")}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryCard({ lang, state, ctx }: { lang: Lang; state: JobState | undefined; ctx: JobView | undefined }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const money = useMoney();
  const job = rt.get(JOB_ID);
  const doneAt = job?.snap.history.find((h) => h.event === "MARK_COMPLETE")?.at;
  const category = categories.find((c) => c.id === session.draft.categoryId);
  const pro = professionals.find((p) => p.id === (ctx?.professionalId ?? session.proId));
  const finished = Boolean(state && ctx && DONE.includes(state));
  return (
    <section aria-labelledby="hub-history" data-module="history" className={`${card} ${PLACE.history}`}>
      <h2 id="hub-history" className="text-[22px] font-bold leading-tight">{t("myhome.history")}</h2>
      {finished && ctx ? (
        <ul className="flex flex-col gap-2">
          <li className="flex flex-col gap-1">
            <p className="break-words font-semibold">{t("myhome.entry", { category: category?.names[lang] ?? "", professional: pro?.name ?? "" })}</p>
            {doneAt && <p className="break-words">{t("myhome.completed", { date: formatDateTime(new Date(doneAt), localeFor[lang]) })}</p>}
            <p className="break-words">{t("myhome.total", { amount: money(ctx.total) })}</p>
          </li>
        </ul>
      ) : <p className="break-words">{t("myhome.noHistory")}</p>}
    </section>
  );
}

function HomeModelCard({ model }: { model: HomeModel }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 pt-2">
      <h3 id="home-model-heading" className="text-lg font-bold">{t("myhome.model.santaSofia")}</h3>
      <p className="break-words">{t("myhome.source")}</p>
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
      {model.plansVaryByPhase && <p>{t("myhome.plansVary")}</p>}
    </div>
  );
}
