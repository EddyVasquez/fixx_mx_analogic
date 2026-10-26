import { useTranslation } from "react-i18next";
import { formatMXN } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import type { Lang } from "@/core/config/fixx.config";

/** Every amount uses the same "$1,250.00 MXN" text in every language, and wraps instead of overflowing. */
export function Money({ amount }: { amount: number }) {
  const { i18n } = useTranslation();
  return <span className="inline-block max-w-full break-words">{formatMXN(amount, localeFor[i18n.language as Lang] ?? "en-US")}</span>;
}

export function useMoney(): (n: number) => string {
  const { i18n } = useTranslation();
  const locale = localeFor[i18n.language as Lang] ?? "en-US";
  return (n: number) => formatMXN(n, locale);
}
