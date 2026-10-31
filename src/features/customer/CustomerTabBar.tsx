import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { House } from "@phosphor-icons/react/House";
import { Question } from "@phosphor-icons/react/Question";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { colors } from "@/ui/tokens";
import { CUSTOMER_TAB_ORDER, type CustomerTab } from "./session";

/** Tailwind slate-600. Checked at 4.5:1 against the white bar. */
export const TAB_INACTIVE = "#475569";
export const TAB_BAR_BG = "#FFFFFF";

/**
 * Icons from the bottom-tab spec, one import each.
 * My jobs, Messages, and Account are not here: those screens do not exist yet.
 * Help stays because the support chat screen already exists.
 */
const ICONS: Record<CustomerTab, typeof House> = {
  home: House,
  request: Wrench,
  warranty: ShieldCheck,
  help: Question
};

const LABELS: Record<CustomerTab, string> = {
  home: "customer.tab.myHome",
  request: "customer.tab.request",
  warranty: "customer.tab.warranty",
  help: "customer.tab.help"
};

function TabLabel({ text, active }: { text: string; active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState(12);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    el.style.fontSize = "12px";
    const next = el.scrollWidth > parent.clientWidth ? 11 : 12;
    el.style.fontSize = "";
    setPx((prev) => (prev === next ? prev : next));
  }, [text, active]);
  return (
    <span
      ref={ref}
      style={{ fontSize: px }}
      className={`inline-block max-w-full whitespace-nowrap text-center leading-[14px] ${active ? "font-semibold text-brand" : "font-normal text-[#475569]"}`}
    >
      {text}
    </span>
  );
}

/** Customer bottom bar. Request is a flat tab, the same width as the others. */
export function CustomerTabBar({ active, onSelect }: { active: CustomerTab; onSelect: (tab: CustomerTab) => void }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("customer.tabs")}
      className="mt-auto w-full border-t border-slate-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 w-full">
        {CUSTOMER_TAB_ORDER.map((tab) => {
          const selected = tab === active;
          const Icon = ICONS[tab];
          const label = t(LABELS[tab]);
          return (
            <a
              key={tab}
              href={`#${tab}`}
              aria-current={selected ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); onSelect(tab); }}
              className="customer-tab relative flex h-full min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 px-1"
            >
              <span aria-hidden="true" className={`absolute top-0 h-[3px] w-6 rounded-full ${selected ? "bg-brand" : "bg-transparent"}`} />
              <Icon
                aria-hidden="true"
                size={24}
                weight={selected ? "fill" : "regular"}
                color={selected ? colors.brand : TAB_INACTIVE}
                data-weight={selected ? "fill" : "regular"}
                data-icon={tab}
              />
              <TabLabel text={label} active={selected} />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
