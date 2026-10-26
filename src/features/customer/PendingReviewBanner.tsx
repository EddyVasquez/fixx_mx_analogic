import { useTranslation } from "react-i18next";

/** Amber warning shown while a regulated job cannot be booked. No fixed width; the text wraps. */
export function PendingReviewBanner() {
  const { t } = useTranslation();
  return (
    <div id="pending-review-banner" role="status" className="flex min-w-0 gap-3 rounded-2xl border-2 border-warnAmberInk bg-warnAmberBg p-3 text-warnAmberInk">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10.5v6" strokeLinecap="round" />
        <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      </svg>
      <div className="min-w-0 break-words">
        <p className="font-bold">{t("review.pending.title")}</p>
        <p>{t("review.pending.body")}</p>
      </div>
    </div>
  );
}
