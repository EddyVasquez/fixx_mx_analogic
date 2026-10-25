import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { categories } from "./data";

export function Home({ name, email, onPick, onUrgent }: { name: string; email: string; onPick: (categoryId: string) => void; onUrgent: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  return (
    <div className="flex flex-col gap-4">
      {email && <p role="status" className="text-sm text-inkSoft">{t("signin.emailSent", { email })}</p>}
      <p className="text-sm font-semibold text-inkSoft">{t("home.greeting", { name })}</p>
      <h2 className="text-2xl font-bold">{t("home.title")}</h2>
      <h3 className="font-semibold">{t("home.choose")}</h3>
      <ul className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c.id)}
              className="flex min-h-[5rem] w-full items-center rounded-2xl border border-line bg-paper px-3 text-left font-bold">
              {c.names[lang]}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-3">
        <p className="text-sm">{t("home.emergencyLine")}</p>
        <Button onClick={onUrgent}>{t("btn.urgentRequest")}</Button>
      </div>
    </div>
  );
}
