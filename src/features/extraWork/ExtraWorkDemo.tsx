import { useSyncExternalStore, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { materialsPrice } from "@/config/revenue";
import {
  EXTRA_WORK, INCREASE_CONSENT, declineChargeCap, increaseSplit, isRegulatedTrade, routeExtraWork, type ExtraWorkLevel
} from "@/core/pricing/extraWork";
import { logAgentReview, logOffCatalogItem } from "@/features/log/unlistedLog";
import { Button } from "@/ui/Button";
import { useMoney } from "@/features/shared/Money";

const LIST_MATERIALS = 78.9;

type Status = "with-agent" | "with-customer" | "pay-failed" | "spei-wait" | "approved" | "declined" | "expired" | "balance-failed";
type Step = "ordered" | "dropoff" | "on-the-way" | "delivered";

interface Proposal {
  status: Status;
  originalNte: number;
  labor: number;
  materials: number;
  delivery: number;
  unlisted: boolean;
  trip: boolean;
  safety: boolean;
  regulated: boolean;
  differentTrade: boolean;
  blocksOriginal: boolean;
  description: string;
  vehicle: "moto" | "van" | null;
  tier: "standard" | "basic";
  reviewUsed: boolean;
  basicRequested: boolean;
  method: "card" | "spei";
  materialsStep: Step | null;
  purchaseCost: number | null;
  tradeId: string;
  language: Lang;
}

let proposal: Proposal | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
function save(next: Proposal | null) { proposal = next; emit(); }

export function useExtraWork(): Proposal | null {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => proposal);
}

function levelKey(level: ExtraWorkLevel): string {
  if (level === "close") return "xw.level.close";
  if (level === "review") return "xw.level.review";
  if (level === "new-work-order") return "xw.level.order";
  return "xw.level.within";
}

const pill = "inline-flex min-h-touch items-center rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold";

/** Demo-only extra-work proposal. No money moves. */
export function ExtraWorkDemo({ role, originalNte, tradeId, lang }: {
  role: "pro" | "customer" | "agent";
  originalNte: number;
  tradeId: string;
  lang: Lang;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const current = useExtraWork();
  const [labor, setLabor] = useState("150");
  const [materialsOn, setMaterialsOn] = useState(true);
  const [unlisted, setUnlisted] = useState(false);
  const [trip, setTrip] = useState(false);
  const [safety, setSafety] = useState(false);
  const [otherTrade, setOtherTrade] = useState(false);
  const [blocks, setBlocks] = useState(false);
  const [cost, setCost] = useState("");

  const open = current != null && current.status !== "declined" && current.status !== "expired" && current.status !== "approved";
  const materials = materialsOn ? LIST_MATERIALS : 0;
  const laborAmount = Number(labor);
  const preview = routeExtraWork({
    originalNte,
    priorApproved: 0,
    increase: (Number.isFinite(laborAmount) ? laborAmount : 0) + materials,
    regulated: isRegulatedTrade(otherTrade ? "carpentry" : tradeId),
    isUnlisted: unlisted,
    differentTrade: otherTrade,
    safety,
    newDeliveryTrip: trip
  });

  const send = () => {
    if (open || !(laborAmount > 0)) return;
    const regulated = isRegulatedTrade(otherTrade ? "carpentry" : tradeId);
    const route = routeExtraWork({
      originalNte, priorApproved: 0, increase: laborAmount + materials,
      regulated, isUnlisted: unlisted, differentTrade: otherTrade, safety, newDeliveryTrip: trip
    });
    const next: Proposal = {
      status: route.requiresAgentReview ? "with-agent" : "with-customer",
      originalNte, labor: laborAmount, materials, delivery: 0, unlisted, trip, safety,
      regulated, differentTrade: otherTrade, blocksOriginal: otherTrade && blocks,
      description: unlisted ? "Unlisted item" : "Extra work",
      vehicle: null, tier: "standard", reviewUsed: route.requiresAgentReview, basicRequested: false,
      method: "card", materialsStep: null, purchaseCost: null, tradeId, language: lang
    };
    save(next);
    if (unlisted) {
      logOffCatalogItem({ queryText: next.description, language: lang, matchedTrade: tradeId, description: next.description, reviewStatus: "pending-review" });
    }
    if (route.requiresAgentReview) {
      logAgentReview({ queryText: next.description, language: lang, matchedTrade: tradeId, description: next.description, amount: null });
    }
  };

  if (role === "pro") {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
        <h3 className="text-lg font-bold">{t("xw.title")}</h3>
        <p className={pill}>{t(levelKey(preview.level))}</p>
        {isRegulatedTrade(tradeId) && <p>{t("xw.regulated")}</p>}
        <p className="text-sm text-inkSoft">{t("xw.keepWorking")}</p>
        {open && <p className="rounded-2xl border-2 border-dashed border-ink p-3">{t("xw.oneAtATime")}</p>}
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("xw.labor")}
          <input className="min-h-touch rounded-xl border-2 border-ink bg-paper px-3" inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value)} />
        </label>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={materialsOn} onChange={(e) => setMaterialsOn(e.target.checked)} />{t("xw.materials")}</label>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={unlisted} onChange={(e) => setUnlisted(e.target.checked)} />{t("xw.unlisted")}</label>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={trip} onChange={(e) => setTrip(e.target.checked)} />{t("xw.trip")}</label>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={otherTrade} onChange={(e) => setOtherTrade(e.target.checked)} />{t("xw.level.order")}</label>
        {otherTrade && <label className="flex min-h-touch items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={blocks} onChange={(e) => setBlocks(e.target.checked)} />{t("xw.blocks")}</label>}
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={safety} onChange={(e) => setSafety(e.target.checked)} />{t("xw.safety")}</label>
        {safety && <p className="text-sm">{t("xw.safetyHint")}</p>}
        <button type="button" className="min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" disabled={open} onClick={send}>
          {otherTrade ? t("xw.requestOrder") : preview.requiresAgentReview ? t("xw.sendFixx") : t("xw.sendCustomer")}
        </button>
      </section>
    );
  }

  if (!current) return null;
  const priced = current.labor + current.materials + (current.unlisted && current.purchaseCost != null ? materialsPrice(current.purchaseCost) : 0) + current.delivery;
  const split = increaseSplit(priced);
  const nextTotal = current.originalNte + split.total;
  const customerSees = current.status === "with-customer" || current.status === "pay-failed" || current.status === "spei-wait" || current.status === "approved" || current.status === "declined" || current.status === "expired" || current.status === "balance-failed";

  if (role === "agent") {
    const needsVehicle = current.trip && current.vehicle == null;
    const needsPrice = current.unlisted && current.purchaseCost == null;
    return (
      <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
        <h3 className="text-lg font-bold">{t("xw.agentTitle")}</h3>
        <p className={pill}>{current.status === "with-agent" ? t("xw.level.review") : current.status}</p>
        {current.unlisted && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("xw.unlisted")}
            <input className="min-h-touch rounded-xl border-2 border-ink bg-paper px-3" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
        )}
        {current.trip && (
          <div className="flex gap-2">
            {(["moto", "van"] as const).map((vehicle) => (
              <button key={vehicle} type="button" className={`min-h-touch rounded-full bg-accent px-5 font-semibold text-ink ${current.vehicle === vehicle ? "ring-2 ring-ink" : ""}`} onClick={() => save({ ...current, vehicle, delivery: EXTRA_WORK.deliveryMxn[vehicle] })}>
                {t(vehicle === "moto" ? "xw.moto" : "xw.van")} {money(EXTRA_WORK.deliveryMxn[vehicle])}
              </button>
            ))}
          </div>
        )}
        <Button disabled={needsVehicle || needsPrice} onClick={() => {
          const purchase = Number(cost);
          save({
            ...current,
            status: "with-customer",
            purchaseCost: Number.isFinite(purchase) && purchase > 0 ? purchase : current.purchaseCost,
            reviewUsed: true
          });
        }}>{t("xw.approveSend")}</Button>
        <div className="flex flex-wrap gap-2">
          {(["ordered", "dropoff", "on-the-way", "delivered"] as const).map((step) => (
            <button key={step} type="button" className={current.materialsStep === step ? "min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" : "min-h-touch rounded-full border-2 border-ink px-4 text-ink"} onClick={() => save({ ...current, materialsStep: step })}>
              {t(step === "ordered" ? "xw.ordered" : step === "dropoff" ? "xw.dropoff" : step === "on-the-way" ? "xw.onTheWay" : "xw.delivered")}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (!customerSees) return null;
  const cap = declineChargeCap(current.originalNte, current.originalNte);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("xw.customerTitle")}</h3>
      <h4 className="font-bold">{t("xw.compare")}</h4>
      <p>{t("xw.original")}: {money(current.originalNte)}</p>
      <p>{t("xw.increase")}: {money(split.total)}</p>
      {current.delivery > 0 && <p>{t("xw.delivery")}: {money(current.delivery)}</p>}
      <p className="text-xl font-bold">{t("xw.newTotal")}: {money(nextTotal)}</p>
      <p>{t("quote.payNow")}: {money(split.deposit)}</p>
      <p>{t("quote.payLater")}: {money(split.balance)}</p>
      <p className="text-sm">{t("xw.remind")}</p>
      <p className="text-sm">{t("xw.warranty")}</p>
      {INCREASE_CONSENT.countsAsConsent && <p className="text-sm">{t("xw.consent")}</p>}
      {current.method === "spei" && <p>{t("xw.speiSlow")}</p>}
      {current.status === "pay-failed" && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{t("xw.cardFail")}</p>
          <div className="flex gap-2">
            <button type="button" className="min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" onClick={() => save({ ...current, status: "approved" })}>{t("xw.retry")}</button>
            <button type="button" className="min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" onClick={() => save({ ...current, status: "approved" })}>{t("xw.changeCard")}</button>
          </div>
        </div>
      )}
      {current.status === "balance-failed" && <p>{t("xw.balanceFail")}</p>}
      {current.status === "declined" && <p>{t("xw.declineCap")} {money(cap)}</p>}
      {(current.status === "with-customer" || current.status === "spei-wait") && (
        <>
          <div className="flex gap-2">
            <button type="button" className={`min-h-touch rounded-full border-2 border-ink px-3 font-semibold ${current.tier === "standard" ? "bg-accent text-ink" : ""}`} onClick={() => save({ ...current, tier: "standard" })}>{t("xw.keepStandard")}</button>
            {current.basicRequested && <button type="button" className={`min-h-touch rounded-full border-2 border-ink px-3 font-semibold ${current.tier === "basic" ? "bg-accent text-ink" : ""}`} onClick={() => save({ ...current, tier: "basic" })}>{t("xw.showBasic")}</button>}
          </div>
          {current.basicRequested && <p className="text-sm">{t("xw.basicLine")}</p>}
          <div className="flex gap-2">
            <button type="button" className={current.method === "card" ? "min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" : "min-h-touch rounded-full border-2 border-ink px-4 text-ink"} onClick={() => save({ ...current, method: "card" })}>{t("method.card")}</button>
            <button type="button" className={current.method === "spei" ? "min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" : "min-h-touch rounded-full border-2 border-ink px-4 text-ink"} onClick={() => save({ ...current, method: "spei" })}>{t("method.spei")}</button>
          </div>
          <Button onClick={() => save({ ...current, status: current.method === "spei" ? "spei-wait" : "approved" })}>{t("xw.approve")}</Button>
          <button type="button" className="min-h-touch text-left font-semibold underline" onClick={() => save({ ...current, status: "pay-failed" })}>{t("xw.cardFail")}</button>
          <button type="button" className="min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" onClick={() => save({ ...current, status: "declined" })}>{t("xw.decline")}</button>
          {!current.reviewUsed
            ? <button type="button" className="min-h-touch text-left font-semibold underline" onClick={() => save({ ...current, status: "with-agent", reviewUsed: true, basicRequested: true })}>{t("xw.askReview")}</button>
            : <p className="text-sm">{t("xw.reviewUsed")}</p>}
          <p className="text-sm">{t("xw.askFixx")}</p>
        </>
      )}
      {current.status === "spei-wait" && <button type="button" className="min-h-touch rounded-full bg-accent px-5 font-semibold text-ink" onClick={() => save({ ...current, status: "approved" })}>{t("xw.retry")}</button>}
      <button type="button" className="min-h-touch text-left text-sm underline" onClick={() => save({ ...current, status: "balance-failed" })}>{t("xw.balanceFail")}</button>
    </section>
  );
}
