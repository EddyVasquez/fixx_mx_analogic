import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DemoBadge } from "@/ui/DemoBadge";
import { DemoPanel } from "@/demo/DemoPanel";
import { DemoJob } from "@/demo/DemoJob";
import { NotificationCenterView } from "@/demo/NotificationCenterView";
import { useRole } from "@/demo/roles";
import { CustomerApp } from "@/features/customer/CustomerApp";
import { ProfessionalApp } from "@/features/professional/ProfessionalApp";
import { AdminApp } from "@/features/admin/AdminApp";
import { SupportConsole } from "@/features/support/SupportConsole";
import type { Lang } from "@/core/config/fixx.config";

export default function App() {
  const { t, i18n } = useTranslation();
  const { role } = useRole();
  // Keep the page language and title in step with the app language.
  useEffect(() => { document.documentElement.lang = i18n.language; document.title = `${t("app.name")} (${t("demo.badge")})`; }, [i18n.language, t]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-5">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">{t("a11y.skip")}</a>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" aria-label={t("app.name")}>
          FI<span className="rounded-md bg-brand px-1 text-paper" aria-hidden="true">X</span><span aria-hidden="true">X</span>
        </h1>
        <DemoBadge />
      </header>

      <main id="main" tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
        <p className="text-sm font-semibold text-inkSoft">{t(`roles.${role}`)}</p>
        {role === "customer" ? <CustomerApp /> : role === "professional" ? <ProfessionalApp /> : role === "admin" ? <AdminApp /> : <SupportConsole lang={i18n.language as Lang} />}
        <details>
          <summary className="min-h-touch cursor-pointer py-3 font-semibold">{t("notifications.title")}</summary>
          <NotificationCenterView />
        </details>
        <details>
          <summary className="min-h-touch cursor-pointer py-3 font-semibold">{t("demoJob.title")}</summary>
          <DemoJob />
        </details>
      </main>

      <div className="mt-auto"><DemoPanel /></div>
    </div>
  );
}
