import { useTranslation } from "react-i18next";
import type { Audience, Channel } from "@/core/machines";
import { formatDateTime, formatMXN } from "@/core/clock/clock";
import type { Lang } from "@/core/config/fixx.config";
import { localeFor } from "@/i18n";
import { notificationText } from "@/mocks/notifications/center";
import { useRuntime } from "./runtime";

/** Shows messages as they would arrive on each person's device, in their language, labelled by channel. */
export function NotificationCenterView({ audience, channel }: { audience?: Audience; channel?: Channel }) {
  const { t, i18n } = useTranslation();
  const rt = useRuntime();
  const app = i18n.language as Lang;
  const records = rt.center.list({ ...(audience ? { audience } : {}), ...(channel ? { channel } : {}) });

  return (
    <section aria-labelledby="notif-title" className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h2 id="notif-title" className="text-lg font-bold">{t("notifications.title")}</h2>
      <p className="text-sm text-inkSoft">{t("notifications.demoNote")}</p>
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {records.length === 0 && <li className="text-inkSoft">{t("notifications.empty")}</li>}
        {records.map((r) => (
          <li key={r.id} className="rounded-xl border border-line p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md border-2 border-ink px-2 font-bold">{t(`channel.${r.channel}`)}</span>
              <span className="font-semibold">{t(`roles.${r.audience}`)}</span>
              <span className="text-inkSoft">{formatDateTime(new Date(r.at), localeFor[app])}</span>
            </p>
            <p className="mt-1">{notificationText(r, (k, o) => t(k, o as never) as unknown as string, (n) => formatMXN(n, localeFor[r.language]))}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
