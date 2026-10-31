import type { Icon } from "@phosphor-icons/react";
import { Broom } from "@phosphor-icons/react/Broom";
import { Bug } from "@phosphor-icons/react/Bug";
import { Cube } from "@phosphor-icons/react/Cube";
import { Drop } from "@phosphor-icons/react/Drop";
import { Fan } from "@phosphor-icons/react/Fan";
import { GridFour } from "@phosphor-icons/react/GridFour";
import { Hammer } from "@phosphor-icons/react/Hammer";
import { HouseLine } from "@phosphor-icons/react/HouseLine";
import { Key } from "@phosphor-icons/react/Key";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { PaintBrush } from "@phosphor-icons/react/PaintBrush";
import { Plant } from "@phosphor-icons/react/Plant";
import { Screwdriver } from "@phosphor-icons/react/Screwdriver";
import { WashingMachine } from "@phosphor-icons/react/WashingMachine";
import { Wrench } from "@phosphor-icons/react/Wrench";
import type { Lang } from "@/core/config/fixx.config";
import { colors } from "@/ui/tokens";
import { categories } from "./data";

/** One icon per home-screen trade. Shortcuts, the request picker, jobs, warranties and quotes all use this map. */
export const TRADE_ICONS: Record<string, Icon> = {
  plumbing: Drop,
  electrical: Lightning,
  hvac: Fan,
  painting: PaintBrush,
  pest_control: Bug,
  gardening: Plant,
  flooring: GridFour,
  concrete: Cube,
  carpentry: Screwdriver,
  appliance: WashingMachine,
  roofing: HouseLine,
  handyman: Hammer,
  locksmith: Key,
  cleaning: Broom
};

export function TradeIcon({ categoryId, size = 24 }: { categoryId: string; size?: number }) {
  const Icon = TRADE_ICONS[categoryId] ?? Wrench;
  return <Icon aria-hidden="true" size={size} weight="bold" color={colors.ink} />;
}

/** Trade name with its shared icon. The icon is hidden from the accessibility tree; the name is the text. */
export function TradeName({ categoryId, lang, size = 22 }: { categoryId: string; lang: Lang; size?: number }) {
  const category = categories.find((item) => item.id === categoryId);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <TradeIcon categoryId={categoryId} size={size} />
      <span className="min-w-0 break-words">{category?.names[lang] ?? categoryId}</span>
    </span>
  );
}
