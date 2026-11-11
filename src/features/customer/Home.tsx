import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { ServiceSearch } from "./ServiceSearch";

export function Home({ name, email, onPick, onJob, onDescribe, onUrgent }: {
  name: string;
  email: string;
  onPick: (categoryId: string) => void;
  onJob: (categoryId: string, taskId: string) => void;
  onDescribe: () => void;
  onUrgent: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  return (
    <div className="flex w-full max-w-[960px] flex-col gap-4">
      <JobStatusBar status="requestSubmitted" progress={0} />
      {email && <p role="status" className="text-sm text-inkSoft">{t("signin.emailSent", { email })}</p>}
      <p className="text-sm font-semibold text-inkSoft">{t("home.greeting", { name })}</p>
      <ServiceSearch lang={lang} onPick={onPick} onJob={onJob} onDescribe={onDescribe} onUrgent={onUrgent} />
    </div>
  );
}
