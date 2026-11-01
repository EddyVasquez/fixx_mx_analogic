import { Plus } from "@phosphor-icons/react/Plus";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { colors } from "@/ui/tokens";
import { categories } from "./data";
import { TradeIcon } from "./tradeIcons";
import "./tradePlus.css";

/** Lime circle with a charcoal plus. The hit target is the touch size; the disc is 36px. */
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
        <Plus aria-hidden="true" size={20} weight="bold" color={colors.onAccent} />
      </span>
    </button>
  );
}

/** Every trade, with a plus that adds or picks it. The grid wraps on narrow screens. */
export function TradePicker({ lang, selectedId, onPick }: {
  lang: Lang;
  selectedId?: string;
  onPick: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const name = category.names[lang];
        const selected = selectedId === category.id;
        return (
          <li key={category.id} className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-paper py-1 pl-3 pr-1">
            <TradeIcon categoryId={category.id} />
            <span className="min-w-0 flex-1 break-words text-left">{name}</span>
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
