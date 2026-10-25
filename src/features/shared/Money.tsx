import { useTranslation } from "react-i18next";
import { formatMXN } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import type { Lang } from "@/core/config/fixx.config";

/** Every amount in the app goes through this, so formatting follows the language. */
export function Money({ amount }: { amount: number }) {
  const { i18n } = useTranslation();
  return <span>{formatMXN(amount, localeFor[i18n.language as Lang] ?? "en-US")}</span>;
}

export function useMoney(): (n: number) => string {
  const { i18n } = useTranslation();
  const locale = localeFor[i18n.language as Lang] ?? "en-US";
  return (n: number) => formatMXN(n, locale);
}
