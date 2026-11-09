import { Check } from "@phosphor-icons/react/Check";
import { Plus } from "@phosphor-icons/react/Plus";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { colors } from "@/ui/tokens";
import { categories } from "./data";
import type { TradeVisual } from "./searchIndex";
import { TradeIcon } from "./tradeIcons";
import "./tradePlus.css";
import "./serviceSearch.css";

/** Lime plus, or a charcoal check once the trade is selected. The hit target is 48px; the disc is 36px. */
export function TradePlusButton({ label, pressed, onClick }: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="trade-plus inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="trade-plus-face" aria-hidden="true">
        {pressed ? (
          <Check aria-hidden="true" size={18} weight="bold" color={colors.accent} data-icon="check" />
        ) : (
          <Plus aria-hidden="true" size={20} weight="bold" color={colors.ink} data-icon="plus" />
        )}
      </span>
    </button>
  );
}

/** Every trade, with a plus that adds or picks it. The grid wraps on narrow screens. */
export function TradePicker({ lang, selectedId, onPick, matches, layout = "rows", gridId }: {
  lang: Lang;
  selectedId?: string;
  onPick: (categoryId: string) => void;
  /** Match glow while searching. Omitted, every tile stays at full strength. */
  matches?: Record<string, TradeVisual>;
  /** Home is a compact 3-column tile on the phone and a row at 768px. */
  layout?: "rows" | "home";
  gridId?: string;
}) {
  const { t } = useTranslation();
  const home = layout === "home";
  const grid = home
    ? "grid grid-cols-3 gap-2"
    : "grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3";
  return (
    <ul id={gridId} className={grid}>
      {categories.map((category) => {
        const name = category.names[lang];
        const selected = selectedId === category.id;
        const match = matches?.[category.id];
        return (
          <li
            key={category.id}
            data-selected={selected ? "true" : "false"}
            data-match={match}
            className={`trade-row service-card flex min-w-0 rounded-2xl border ${home ? "service-card-home" : "items-center gap-2 py-1 pl-3 pr-1"} ${selected ? "border-accent bg-accent font-semibold" : "border-line bg-paper"}`}
          >
            <TradeIcon categoryId={category.id} />
            <span className="trade-label min-w-0 flex-1 break-words text-left">{name}</span>
            <TradePlusButton
              label={t("trade.add", { trade: name })}
              pressed={selectedId === undefined ? undefined : selected}
              onClick={() => onPick(category.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
