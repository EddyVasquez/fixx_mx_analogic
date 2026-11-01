import { useTranslation } from "react-i18next";
import { Bathtub } from "@phosphor-icons/react/Bathtub";
import { Bed } from "@phosphor-icons/react/Bed";
import { Ruler } from "@phosphor-icons/react/Ruler";
import { Snowflake } from "@phosphor-icons/react/Snowflake";
import type { Icon } from "@phosphor-icons/react";
import type { Draft } from "./session";

/** Read-only home facts the quote still uses. Edit them on My Home, not on this request. */
export function HomeSummaryCard({ draft, onEditHome }: { draft: Draft; onEditHome?: () => void }) {
  const { t } = useTranslation();
  const facts: { id: string; label: string; value: string; Icon: Icon }[] = [
    { id: "cleaning", label: t("request.cleaningSize"), value: draft.cleaningTier || t("request.cleaningSizeUnset"), Icon: Ruler },
    { id: "minisplits", label: t("request.minisplits"), value: String(draft.minisplits), Icon: Snowflake },
    { id: "bathrooms", label: t("request.bathrooms"), value: String(draft.bathrooms), Icon: Bathtub },
    { id: "bedrooms", label: t("request.bedrooms"), value: String(draft.bedrooms), Icon: Bed }
  ];
  return (
    <section aria-labelledby="from-my-home" data-testid="home-summary" className="glass flex flex-col gap-2 rounded-[20px] border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="from-my-home" className="text-sm font-semibold text-inkSoft">{t("request.fromMyHome")}</h3>
        {onEditHome && (
          <button type="button" className="min-h-touch shrink-0 px-1 text-sm font-semibold text-ink underline" onClick={onEditHome}>
            {t("request.editInMyHome")}
          </button>
        )}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold leading-snug">
        <span className="whitespace-nowrap">{draft.homeownerName}</span>
        <span className="whitespace-nowrap font-normal text-inkSoft">
          <span aria-hidden="true">· </span>
          <span>{draft.community}</span>
        </span>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {facts.map((fact) => (
          <li key={fact.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm leading-tight">
            <fact.Icon aria-hidden="true" size={16} weight="bold" color="currentColor" />
            <span className="text-inkSoft">{fact.label}</span>
            <span className="font-semibold">{fact.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
