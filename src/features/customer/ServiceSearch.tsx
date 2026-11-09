import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "@phosphor-icons/react/Clock";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { X } from "@phosphor-icons/react/X";
import type { Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { colors } from "@/ui/tokens";
import { searchServices, type SearchChip } from "./searchIndex";
import { TradePicker } from "./tradePicker";
import "./serviceSearch.css";

const GRID_ID = "service-grid";
const LIVE_ID = "search-live";

export function ServiceSearch({ lang, onPick, onJob, onDescribe, onUrgent }: {
  lang: Lang;
  onPick: (categoryId: string) => void;
  onJob: (categoryId: string, taskId: string) => void;
  onDescribe: () => void;
  onUrgent: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    timer.current = window.setTimeout(() => setApplied(query), 150);
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [query]);

  const applyNow = (value: string) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    setApplied(value);
  };

  const clear = () => {
    setQuery("");
    applyNow("");
    inputRef.current?.focus();
  };

  const result = searchServices(applied, lang);
  const searching = applied.trim().length > 0;
  const live = !searching
    ? ""
    : result.empty
      ? t("search.none")
      : t("search.matches", { n: result.tradeCount, m: result.jobCount });

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        className="service-search"
        onSubmit={(event) => {
          event.preventDefault();
          applyNow(query);
        }}
      >
        <MagnifyingGlass aria-hidden="true" size={20} weight="bold" color={colors.inkSoft} />
        <label className="sr-only" htmlFor="service-search">{t("search.placeholder")}</label>
        <input
          ref={inputRef}
          id="service-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t("search.placeholder")}
          aria-controls={GRID_ID}
          aria-describedby={LIVE_ID}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyNow(query);
          }}
        />
        {query.trim().length > 0 && (
          <button type="button" className="search-clear inline-flex min-h-touch min-w-touch items-center justify-center" aria-label={t("search.clear")} onClick={clear}>
            <span className="search-clear-disc" aria-hidden="true">
              <X aria-hidden="true" size={16} weight="bold" color={colors.paper} />
            </span>
          </button>
        )}
      </form>

      {searching && result.chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.chips.map((chip) => (
            <SuggestionChip key={chip.taskId} chip={chip} review={t("search.needsReview")} onPick={() => onJob(chip.categoryId, chip.taskId)} />
          ))}
        </div>
      )}

      <p id={LIVE_ID} aria-live="polite" className={searching ? "text-sm font-semibold text-inkSoft" : "sr-only"}>{live}</p>

      {result.empty ? (
        <div id={GRID_ID} hidden />
      ) : null}
      {result.empty ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-ink bg-paper p-4">
          <h3 className="text-lg font-bold">{t("search.emptyTitle")}</h3>
          <p>{t("search.emptyBody")}</p>
          <button type="button" className="search-describe inline-flex min-h-touch items-center justify-center px-5" onClick={onDescribe}>
            {t("search.describe")}
          </button>
          <Button variant="secondary" onClick={onUrgent}>{t("btn.urgentRequest")}</Button>
        </div>
      ) : (
        <>
          <h3 className="font-semibold">{t("home.choose")}</h3>
          <TradePicker lang={lang} layout="home" gridId={GRID_ID} matches={searching ? result.trades : undefined} onPick={onPick} />
        </>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-3">
        <p className="text-sm">{t("home.emergencyLine")}</p>
        {!result.empty && <Button onClick={onUrgent}>{t("btn.urgentRequest")}</Button>}
      </div>
    </div>
  );
}

function SuggestionChip({ chip, review, onPick }: { chip: SearchChip; review: string; onPick: () => void }) {
  return (
    <button type="button" className="search-chip inline-flex min-h-touch max-w-full flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1 text-left" onClick={onPick}>
      <span>{chip.title}<span className="font-medium text-inkSoft"> · {chip.tradeName}</span></span>
      {chip.pendingReview && (
        <span className="search-review">
          <Clock aria-hidden="true" size={14} weight="bold" color={colors.ink} />
          {review}
        </span>
      )}
    </button>
  );
}
