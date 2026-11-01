import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { focusTargetClass } from "@/ui/Field";
import { TradePicker } from "./tradePicker";

export function Home({ name, email, onPick, onUrgent }: { name: string; email: string; onPick: (categoryId: string) => void; onUrgent: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <div className="flex flex-col gap-4">
      {email && <p role="status" className="text-sm text-inkSoft">{t("signin.emailSent", { email })}</p>}
      <p className="text-sm font-semibold text-inkSoft">{t("home.greeting", { name })}</p>
      <h2 ref={headingRef} tabIndex={-1} className={`text-2xl font-bold ${focusTargetClass}`}>{t("home.title")}</h2>
      <h3 className="font-semibold">{t("home.choose")}</h3>
      <TradePicker lang={lang} onPick={onPick} />
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-3">
        <p className="text-sm">{t("home.emergencyLine")}</p>
        <Button onClick={onUrgent}>{t("btn.urgentRequest")}</Button>
      </div>
    </div>
  );
}
