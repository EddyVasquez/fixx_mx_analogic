import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bathtub } from "@phosphor-icons/react/Bathtub";
import { Bed } from "@phosphor-icons/react/Bed";
import { Car } from "@phosphor-icons/react/Car";
import { Clock } from "@phosphor-icons/react/Clock";
import { Ruler } from "@phosphor-icons/react/Ruler";
import { Snowflake } from "@phosphor-icons/react/Snowflake";
import { Stairs } from "@phosphor-icons/react/Stairs";
import type { Icon } from "@phosphor-icons/react";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { JobState, WarrantyCtx, WarrantyState } from "@/core/machines";
import { localeFor } from "@/i18n";
import { useRuntime } from "@/demo/runtime";
import { stateLabel } from "@/features/admin/sections";
import { useMoney } from "@/features/shared/Money";
import { Button } from "@/ui/Button";
import { colors } from "@/ui/tokens";
import { BlueprintSlot } from "./blueprint/BlueprintSlot";
import type { FactId } from "./blueprint/houseFocus";
import { useCustomerWide } from "./CustomerTabBar";
import { categories, professionals } from "./data";
import { setDemoMode, useDemoMode } from "./demoMode";
import { demoJobViews, demoWarrantyViews, type DemoJobView, type DemoWarrantyView } from "./demoSamples";
import { formatArea, type HomeModel } from "./homeModel";
import { useHomeProfile } from "./homeProfile";
import { JOB_ID, session } from "./session";
import { TradePlusButton } from "./tradePicker";
import { TradeIcon, TradeName } from "./tradeIcons";
import "./homeGlass.css";

const DONE: JobState[] = ["paymentReleased", "rated"];

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

/** H2 cockpit. Phone stacks in source order. Tablet is 6 columns and desktop is 12, with no empty cells. */
const PLACE = {
  hero: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-1 lg:col-span-12 lg:col-start-1 lg:row-start-1",
  active: "col-span-1 md:col-span-3 md:col-start-1 md:row-start-2 lg:col-span-4 lg:col-start-1 lg:row-start-2 lg:row-span-2",
  warranty: "col-span-1 md:col-span-3 md:col-start-4 md:row-start-2 lg:col-span-4 lg:col-start-5 lg:row-start-2 lg:row-span-2",
  maintenance: "col-span-1 md:col-span-3 md:col-start-1 md:row-start-3 lg:col-span-4 lg:col-start-9 lg:row-start-2",
  documents: "col-span-1 md:col-span-3 md:col-start-1 md:row-start-4 lg:col-span-4 lg:col-start-9 lg:row-start-3",
  history: "col-span-1 md:col-span-3 md:col-start-4 md:row-start-3 md:row-span-2 lg:col-span-4 lg:col-start-9 lg:row-start-4 lg:row-span-1",
  details: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-5 lg:col-span-8 lg:col-start-1 lg:row-start-4",
  demo: "col-span-1 md:col-span-6 md:col-start-1 md:row-start-6 lg:col-span-12 lg:col-start-1 lg:row-start-5"
} as const;

const card = "flex min-w-0 flex-col gap-3 self-stretch rounded-[20px] border border-line bg-paper p-4 shadow-[0_8px_24px_rgba(46,46,46,0.08)] md:rounded-3xl md:p-6";

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

function useMatch(query: string): boolean {
  const [on, setOn] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const apply = () => setOn(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return on;
}

function OutlineBadge({ label }: { label: string }) {
  return (
    <p className="home-outline-badge">
      <Clock aria-hidden="true" size={16} weight="bold" color={colors.ink} />
      {label}
    </p>
  );
}

function ExampleTag() {
  const { t } = useTranslation();
  return <span className="inline-flex items-center rounded bg-warnBg px-1.5 py-0.5 text-xs font-semibold text-warnInk">{t("myhome.hub.example")}</span>;
}

function DemoTag() {
  const { t } = useTranslation();
  return <span className="inline-flex items-center rounded bg-warnBg px-1.5 py-0.5 text-xs font-semibold text-warnInk">{t("demo.badge")}</span>;
}

function Meter({ label, percent }: { label: string; percent: number }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-mist"
    >
      <div className="h-full bg-brand" style={{ width: `${value}%` }} />
    </div>
  );
}

function DemoModeSwitch() {
  const { t } = useTranslation();
  const on = useDemoMode();
  return (
    <div data-testid="demo-mode" className="flex flex-col gap-2">
      <label className="flex min-h-touch items-center gap-3 font-semibold">
        <input type="checkbox" checked={on} onChange={(event) => setDemoMode(event.target.checked)} />
        {t("demo.mode.label")}
      </label>
      <p className="break-words">{t("demo.mode.note")}</p>
    </div>
  );
}

/** Tablet-first home hub. Real modules use runtime and profile data. Maintenance and documents are examples. */
export function MyHomeTab({ lang, onNavigate }: { lang: Lang; onNavigate: () => void }) {
  const { t } = useTranslation();
  const rt = useRuntime();
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
  const wide = useCustomerWide();
  const tablet = useMatch("(min-width: 768px) and (max-width: 1023.98px)");
  const [pressed, setPressed] = useState<FactId | null>(null);
  const [hover, setHover] = useState<FactId | null>(null);
  const shown = pressed ?? hover;
  const [roomsOpen, setRoomsOpen] = useState(wide);
  useEffect(() => { setRoomsOpen(wide); }, [wide]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPressed(null);
      setHover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div data-testid="home-hub" className="grid grid-cols-1 items-stretch gap-4 text-[16px] leading-6 text-ink md:grid-cols-6 md:gap-6 lg:grid-cols-12">
      <section aria-labelledby="home-hero-name" data-module="hero" className={`${PLACE.hero} flex min-w-0 flex-col self-stretch`}>
        <div className="cockpit">
          <div className="cockpit-identity">
            <Identity lang={lang} name={profile.homeownerName} community={profile.community} address={profile.address} model={model} time={formatClockTime(now, locale)} />
          </div>
          <div
            className="cockpit-viewport"
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest(".cockpit-callout")) return;
              setPressed(null);
            }}
          >
            <div className="cockpit-ticks" aria-hidden="true"><span /><span /><span /><span /></div>
            <div className="cockpit-stage" aria-hidden="true">
              <BlueprintSlot label={t("myhome.hub.blueprint")} focus={shown} wide={wide} tablet={tablet} onClear={() => setPressed(null)} />
            </div>
            <p className="cockpit-callout" aria-live="polite" data-empty={model && shown ? "false" : "true"}>{model && shown ? calloutText(t, shown, model) : ""}</p>
          </div>
          {model && (
            <Readouts
              model={model}
              pressed={pressed}
              onToggle={(id) => setPressed((current) => current === id ? null : id)}
              onHover={setHover}
            />
          )}
        </div>
      </section>

      <ActiveJob lang={lang} active={active} now={now} onView={() => openRequest(null)} onRequest={() => openRequest(null)} />

        <WarrantyCard lang={lang} actor={warrantyActor} now={now} onOpen={openWarranty} />

        <section aria-labelledby="hub-maintenance" data-module="maintenance" className={`${card} ${PLACE.maintenance}`}>
          <h2 id="hub-maintenance" className="text-[22px] font-bold leading-tight">{t("myhome.hub.maintenance")}</h2>
          <p className="break-words">{t("myhome.hub.exampleNote")}</p>
          <ul className="flex flex-col gap-3">
            {MAINTENANCE.map((item) => {
              const trade = categories.find((category) => category.id === item.categoryId)?.names[lang] ?? item.categoryId;
              return (
                <li key={item.key} className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-paper py-1 pl-3 pr-1">
                  <TradeIcon categoryId={item.categoryId} />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <ExampleTag />
                    <span className="break-words">{t(item.key)}</span>
                  </span>
                  <TradePlusButton label={t("trade.add", { trade })} onClick={() => openRequest(item.categoryId)} />
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="hub-documents" data-module="documents" className={`${card} ${PLACE.documents}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="hub-documents" className="text-[22px] font-bold leading-tight">{t("myhome.hub.documents")}</h2>
            <ExampleTag />
          </div>
          <p className="break-words">{t("myhome.hub.exampleNote")}</p>
          <p className="break-words">{t("myhome.hub.docsEmpty")}</p>
        </section>

        <HistoryCard lang={lang} state={state} ctx={ctx} />

        {model && (
          <section aria-labelledby="hub-rooms" data-module="details" className={`${card} ${PLACE.details}`}>
            <details open={roomsOpen} onToggle={(event) => setRoomsOpen((event.currentTarget as HTMLDetailsElement).open)}>
              <summary className="min-h-touch cursor-pointer py-2">
                <h2 id="hub-rooms" className="inline text-[22px] font-bold leading-tight">{t("myhome.hub.rooms")}</h2>
              </summary>
              <HomeModelCard model={model} />
            </details>
          </section>
        )}

        <section aria-labelledby="hub-demo" data-module="demo" className={`${card} ${PLACE.demo}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="hub-demo" className="sr-only">{t("demo.badge")}</h2>
            <DemoTag />
          </div>
          <DemoModeSwitch />
        </section>
    </div>
  );
}

function Identity({ lang, name, community, address, model, time }: {
  lang: Lang;
  name: string;
  community: string;
  address: string;
  model: HomeModel | null | undefined;
  time: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      {lang === "ko" && <p className="font-semibold">{t("myhome.translationDraft")}</p>}
      <h1 id="home-hero-name" className="break-words text-[24px] font-bold leading-tight md:text-[20px]">{name}</h1>
      <p className="break-words">{t("myhome.community", { name: community })}</p>
      <p className="break-words">{t("myhome.address", { address })}</p>
      {model && <p className="break-words font-semibold">{t("myhome.hub.modelLine", { model: t("myhome.model.santaSofia"), developer: model.developer })}</p>}
      <p className="text-inkSoft">{t("myhome.hub.updated", { time })}</p>
    </>
  );
}

function calloutText(t: (key: string, vars?: Record<string, string | number>) => string, fact: FactId, model: HomeModel): string {
  if (fact === "garage") return t("myhome.garage", { min: model.garageCarsMin, max: model.garageCarsMax });
  const bathrooms = model.groundFullBathrooms + model.upperFullBathrooms;
  const label = t(`myhome.hub.stat.${fact}`);
  const value = fact === "built" ? t("myhome.hub.areaValue", { area: formatArea(model.builtM2) }) : String(fact === "stories" ? model.stories : fact === "bedrooms" ? model.bedrooms : fact === "bathrooms" ? bathrooms : model.minisplits);
  return `${label} ${value}`;
}

function BuiltValue({ area }: { area: string }) {
  const { t } = useTranslation();
  const text = t("myhome.hub.areaValue", { area });
  const split = text.lastIndexOf(" ");
  if (split < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, split)}
      <span className="home-readout-unit">{text.slice(split)}</span>
    </>
  );
}

function Readouts({ model, pressed, onToggle, onHover }: {
  model: HomeModel;
  pressed: FactId | null;
  onToggle: (id: FactId) => void;
  onHover: (id: FactId | null) => void;
}) {
  const { t } = useTranslation();
  const bathrooms = model.groundFullBathrooms + model.upperFullBathrooms;
  const range = model.garageCarsMin === model.garageCarsMax ? String(model.garageCarsMax) : `${model.garageCarsMin}–${model.garageCarsMax}`;
  const tiles: { id: FactId; label: string; Icon: Icon }[] = [
    { id: "stories", label: t("myhome.hub.stat.stories"), Icon: Stairs },
    { id: "built", label: t("myhome.hub.stat.built"), Icon: Ruler },
    { id: "bedrooms", label: t("myhome.hub.stat.bedrooms"), Icon: Bed },
    { id: "bathrooms", label: t("myhome.hub.stat.bathrooms"), Icon: Bathtub },
    { id: "minisplits", label: t("myhome.hub.stat.minisplits"), Icon: Snowflake },
    { id: "garage", label: t("myhome.hub.stat.garage"), Icon: Car }
  ];
  return (
    <div className="cockpit-console" role="group" aria-label={t("myhome.hub.rooms")}>
      {tiles.map((tile) => {
        const selected = pressed === tile.id;
        const ink = selected ? colors.mist : colors.ink;
        return (
          <button
            key={tile.id}
            type="button"
            className="home-readout min-h-[5.5rem]"
            data-fact={tile.id}
            aria-pressed={selected}
            aria-label={tile.id === "garage" ? `${tile.label} ${range}` : undefined}
            onClick={() => onToggle(tile.id)}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") onHover(tile.id); }}
            onPointerLeave={() => onHover(null)}
          >
            <tile.Icon aria-hidden="true" size={22} weight="bold" color={ink} />
            <span className="home-readout-label">{tile.label}</span>
            <span className="home-readout-value" aria-hidden={tile.id === "garage" ? true : undefined}>
              {tile.id === "built" && <BuiltValue area={formatArea(model.builtM2)} />}
              {tile.id === "stories" && model.stories}
              {tile.id === "bedrooms" && model.bedrooms}
              {tile.id === "bathrooms" && bathrooms}
              {tile.id === "minisplits" && model.minisplits}
              {tile.id === "garage" && (
                model.garageCarsMax <= 0 ? t("myhome.hub.none") : (
                  <>
                    <Car aria-hidden="true" size={26} weight="fill" color={ink} />
                    {model.garageCarsMax > model.garageCarsMin && (
                      <span className="home-car-slot">
                        <Car aria-hidden="true" size={22} weight="bold" color={ink} />
                      </span>
                    )}
                    <span className="home-readout-range">{range}</span>
                  </>
                )
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ActiveJob({ lang, active, now, onView, onRequest }: {
  lang: Lang;
  active: { state: JobState; ctx: JobView } | null;
  now: Date;
  onView: () => void;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const demoOn = useDemoMode();
  const samples = demoOn ? demoJobViews(now, lang) : [];
  const rt = useRuntime();
  const categoryId = session.draft.categoryId || rt.get(JOB_ID)?.meta.categoryId || "";
  const category = categories.find((item) => item.id === categoryId);
  const proId = active?.ctx.professionalId ?? session.proId;
  const pro = professionals.find((item) => item.id === proId);
  const price = active ? priced(active.ctx) : null;
  const when = active ? nextMoment(active.ctx) : null;
  const statusText = active ? stateLabel(t, active.state) : t("myhome.hub.noActive");

  return (
    <section aria-labelledby="hub-active" data-module="active" className={`${card} ${PLACE.active}`}>
      <h2 id="hub-active" className="text-[22px] font-bold leading-tight">{t("myhome.hub.activeJob")}</h2>
      {active && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
          <div className="flex items-start gap-2">
            <TradeIcon categoryId={categoryId} />
            <p className="break-words font-semibold">
              {pro
                ? t("myhome.entry", { category: category?.names[lang] ?? "", professional: pro.name })
                : (category?.names[lang] ?? "")}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-ink" />
            {active.state === "pendingReview" ? (
              <OutlineBadge label={t("review.pending.title")} />
            ) : (
              <p aria-live="polite" className="min-w-0 break-words">{statusText}</p>
            )}
          </div>
          {when && <p className="break-words">{t("myhome.hub.next", { date: formatDateTime(when, localeFor[lang]) })}</p>}
          {price && <p className="break-words">{t(price.key, { amount: money(price.amount) })}</p>}
          <div className="pt-2">
            <Button onClick={onView}>{t("myhome.hub.viewJob")}</Button>
          </div>
        </div>
      )}
      {samples.map((sample) => <DemoJobCard key={sample.id} lang={lang} job={sample} />)}
      {!active && samples.length === 0 && (
        <div className="flex flex-1 flex-col gap-3">
          <p aria-live="polite" className="break-words">{t("myhome.hub.noActive")}</p>
          <div className="mt-auto">
            <Button onClick={onRequest}>{t("customer.tab.request")}</Button>
          </div>
        </div>
      )}
      {!active && samples.length > 0 && (
        <div className="mt-auto">
          <Button onClick={onRequest}>{t("customer.tab.request")}</Button>
        </div>
      )}
    </section>
  );
}

function DemoJobCard({ lang, job }: { lang: Lang; job: DemoJobView }) {
  const { t } = useTranslation();
  const money = useMoney();
  const category = categories.find((item) => item.id === job.categoryId);
  return (
    <article data-demo-job={job.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <DemoTag />
        {job.pendingReview ? (
          <OutlineBadge label={t("review.pending.title")} />
        ) : (
          <p className="break-words font-semibold">{job.status === "inProgress" ? t("status.inProgress") : t("status.scheduled")}</p>
        )}
      </div>
      <div className="flex items-start gap-2">
        <TradeIcon categoryId={job.categoryId} />
        <p className="break-words font-semibold">{t("myhome.entry", { category: category?.names[lang] ?? "", professional: job.professionalName })}</p>
      </div>
      <p className="break-words">{job.title}</p>
      <p className="break-words">{t("myhome.hub.next", { date: formatDateTime(job.when, localeFor[lang]) })}</p>
      <p className="break-words">{t("myhome.total", { amount: money(job.total) })}</p>
      <Meter label={t("demo.job.progress")} percent={job.progress} />
    </article>
  );
}

function WarrantyCard({ lang, actor, now, onOpen }: {
  lang: Lang;
  actor: ReturnType<ReturnType<typeof useRuntime>["get"]>;
  now: Date;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const demoOn = useDemoMode();
  const samples = demoOn ? demoWarrantyViews(now, lang) : [];
  const c = actor?.snap.ctx as WarrantyCtx | undefined;
  const st = actor?.snap.state as WarrantyState | undefined;
  const days = c ? warrantyDays(c.endsAt, now) : 0;
  const ratio = c ? warrantyRatio(c.startsAt, c.endsAt, now) : 0;
  const percent = Math.round(ratio * 100);
  const hasReal = Boolean(c && st);
  return (
    <section aria-labelledby="hub-warranty" data-module="warranty" className={`${card} ${PLACE.warranty}`}>
      <h2 id="hub-warranty" className="text-[22px] font-bold leading-tight">{t("myhome.hub.warranty")}</h2>
      {hasReal && c && st && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
          <div className="flex items-center gap-2">
            <TradeIcon categoryId={session.draft.categoryId} />
            <TradeName categoryId={session.draft.categoryId} lang={lang} />
          </div>
          <p className="inline-flex w-fit max-w-full items-center break-words rounded-full border border-line bg-mist px-3 py-1 font-semibold">{t(WARRANTY_CHIP[st])}</p>
          <p className="break-words">{t("myhome.hub.daysLeft", { n: days })}</p>
          <Meter label={t("myhome.hub.warranty")} percent={percent} />
        </div>
      )}
      {samples.map((sample) => <DemoWarrantyCard key={sample.id} lang={lang} item={sample} />)}
      {!hasReal && samples.length === 0 && <p className="break-words">{t("myhome.hub.noWarranty")}</p>}
      <div className="mt-auto pt-2">
        <Button variant="secondary" onClick={onOpen}>{t("myhome.hub.openWarranty")}</Button>
      </div>
    </section>
  );
}

function DemoWarrantyCard({ lang, item }: { lang: Lang; item: DemoWarrantyView }) {
  const { t } = useTranslation();
  const span = config.warrantyDaysByCategory[item.categoryId] ?? 30;
  const used = Math.min(span, Math.max(span - item.daysLeft, 0));
  const percent = span > 0 ? Math.round((used / span) * 100) : 0;
  const chip = item.claimInProgress
    ? t("demo.warranty.claim")
    : item.expiringSoon
      ? t("demo.warranty.expiring")
      : t("myhome.hub.warrantyState.active");
  return (
    <article data-demo-warranty={item.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <DemoTag />
        <p className="inline-flex w-fit max-w-full items-center break-words rounded-full border border-line bg-mist px-3 py-1 font-semibold">{chip}</p>
      </div>
      <div className="flex items-start gap-2">
        <TradeIcon categoryId={item.categoryId} />
        <p className="break-words font-semibold">{t("myhome.entry", { category: categories.find((c) => c.id === item.categoryId)?.names[lang] ?? "", professional: item.professionalName })}</p>
      </div>
      <p className="break-words">{item.title}</p>
      <p className="break-words">{t("demo.warranty.ends", { date: formatDateTime(item.endsAt, localeFor[lang]) })}</p>
      <p className="break-words">{t("myhome.hub.daysLeft", { n: item.daysLeft })}</p>
      <Meter label={t("demo.job.progress")} percent={percent} />
    </article>
  );
}

function HistoryCard({ lang, state, ctx }: { lang: Lang; state: JobState | undefined; ctx: JobView | undefined }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const money = useMoney();
  const job = rt.get(JOB_ID);
  const doneAt = job?.snap.history.find((h) => h.event === "MARK_COMPLETE")?.at;
  const categoryId = session.draft.categoryId || job?.meta.categoryId || "";
  const category = categories.find((item) => item.id === categoryId);
  const pro = professionals.find((item) => item.id === (ctx?.professionalId ?? session.proId));
  const finished = Boolean(state && ctx && DONE.includes(state));
  return (
    <section aria-labelledby="hub-history" data-module="history" className={`${card} ${PLACE.history}`}>
      <h2 id="hub-history" className="text-[22px] font-bold leading-tight">{t("myhome.history")}</h2>
      {finished && ctx ? (
        <ul className="flex flex-col gap-2">
          <li className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <TradeIcon categoryId={categoryId} />
              <p className="break-words font-semibold">{t("myhome.entry", { category: category?.names[lang] ?? "", professional: pro?.name ?? "" })}</p>
            </div>
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
    <div className="home-rooms pt-2">
      <div className="flex flex-col gap-2">
      <h3 id="home-model-heading" className="text-lg font-bold">{t("myhome.model.santaSofia")}</h3>
      <p className="break-words">{t("myhome.source")}</p>
      <p>{t("myhome.stories", { count: model.stories })}</p>
      <p>{model.lotApproximate ? t("myhome.lotAbout", { area: formatArea(model.lotM2) }) : t("myhome.lot", { area: formatArea(model.lotM2) })}</p>
      <p>{t("myhome.built", { area: formatArea(model.builtM2) })}</p>
      </div>
      <div className="flex flex-col gap-2">
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
      </div>
      <div className="flex flex-col gap-2">
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
    </div>
  );
}
