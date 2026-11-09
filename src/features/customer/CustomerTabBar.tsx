import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { House } from "@phosphor-icons/react/House";
import { Question } from "@phosphor-icons/react/Question";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { colors } from "@/ui/tokens";
import { CUSTOMER_TAB_ORDER, type CustomerTab } from "./session";
import "./customerNav.css";

/** Inactive tab ink. Checked at 4.5:1 against the glass bar. */
export const TAB_INACTIVE = colors.inkSoft;
export const TAB_BAR_BG = colors.paper;
/** Active segment is charcoal, so the icon and label use paper. */
export const TAB_ACTIVE = colors.paper;

const WIDE_QUERY = "(min-width: 768px)";

/** True at the tablet breakpoint. Tests and phones without matchMedia stay on the bottom pill. */
export function useCustomerWide(): boolean {
  const [wide, setWide] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(WIDE_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE_QUERY);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return wide;
}

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

/**
 * Label that shrinks a pixel at a time until it fits its box.
 * Truncation is the last resort, and only after the minimum size.
 */
function TabLabel({ text, active, placement }: { text: string; active: boolean; placement: "phone" | "top" }) {
  const phone = placement === "phone";
  const maxPx = phone ? 12 : 13;
  const minPx = phone ? 8 : 11;
  const ref = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState(maxPx);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancel = false;
    const fit = () => {
      if (cancel) return;
      let size = maxPx;
      el.style.fontSize = `${size}px`;
      if (el.clientWidth <= 0) {
        el.style.fontSize = "";
        setPx((prev) => (prev === maxPx ? prev : maxPx));
        return;
      }
      while (size > minPx && el.scrollWidth > el.clientWidth + 1) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      el.style.fontSize = `${size}px`;
      setPx((prev) => (prev === size ? prev : size));
    };
    fit();
    const parent = el.parentElement;
    const observer = typeof ResizeObserver === "function" && parent ? new ResizeObserver(fit) : null;
    if (parent) observer?.observe(parent);
    const fonts = document.fonts;
    fonts?.ready.then(() => { if (!cancel) fit(); }).catch(() => undefined);
    return () => {
      cancel = true;
      observer?.disconnect();
    };
  }, [text, active, maxPx, minPx]);
  return (
    <span
      ref={ref}
      style={{ fontSize: px }}
      className={`min-w-0 shrink overflow-hidden whitespace-nowrap text-center leading-[1.15] ${active ? "font-semibold text-paper" : "font-normal text-inkSoft"}`}
    >
      {text}
    </span>
  );
}

function TabLinks({ active, onSelect, placement }: {
  active: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
  placement: "phone" | "top";
}) {
  const { t } = useTranslation();
  const phone = placement === "phone";
  return (
    <>
      {CUSTOMER_TAB_ORDER.map((tab) => {
        const selected = tab === active;
        const Icon = ICONS[tab];
        return (
          <a
            key={tab}
            href={`#${tab}`}
            aria-current={selected ? "page" : undefined}
            onClick={(event) => { event.preventDefault(); onSelect(tab); }}
            className={phone
              ? "customer-tab flex min-h-touch min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1"
              : "customer-tab inline-flex min-h-touch min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5"}
          >
            <Icon
              aria-hidden="true"
              size={18}
              weight={selected ? "fill" : "regular"}
              color={selected ? TAB_ACTIVE : TAB_INACTIVE}
              data-weight={selected ? "fill" : "regular"}
              data-icon={tab}
              className="shrink-0"
            />
            <TabLabel text={t(LABELS[tab])} active={selected} placement={placement} />
          </a>
        );
      })}
    </>
  );
}

function FixxMark() {
  const { t } = useTranslation();
  return (
    <div className="customer-brand">
      <span className="customer-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="22" height="22" focusable="false">
          <path d="M14 14 H25 L50 50 H39 Z M39 14 H50 L25 50 H14 Z" fill="currentColor" />
        </svg>
      </span>
      <span className="customer-word">{t("app.name")}</span>
    </div>
  );
}

function PhoneNav({ active, onSelect }: { active: CustomerTab; onSelect: (tab: CustomerTab) => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    document.body.classList.add("has-customer-phonebar");
    return () => document.body.classList.remove("has-customer-phonebar");
  }, []);
  return (
    <nav aria-label={t("customer.tabs")} className="customer-phonebar" data-placement="phone">
      <div className="customer-seg">
        <TabLinks active={active} onSelect={onSelect} placement="phone" />
      </div>
    </nav>
  );
}

function TopNav({ active, onSelect }: { active: CustomerTab; onSelect: (tab: CustomerTab) => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("customer.tabs")} className="customer-topnav" data-placement="top">
      <div className="customer-topnav-bar">
        <FixxMark />
        <div className="customer-seg customer-seg-top">
          <TabLinks active={active} onSelect={onSelect} placement="top" />
        </div>
        <div className="customer-topnav-spacer" aria-hidden="true" />
      </div>
    </nav>
  );
}

/** Phones keep a bottom pill. At 768px and up the same tabs move into the sticky glass header. */
export function CustomerNav({ placement, active, onSelect }: {
  placement: "phone" | "top";
  active: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
}) {
  return placement === "top"
    ? <TopNav active={active} onSelect={onSelect} />
    : <PhoneNav active={active} onSelect={onSelect} />;
}
