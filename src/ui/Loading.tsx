import { useTranslation } from "react-i18next";

/** Announced to screen readers while something loads. */
export function Loading() {
  const { t } = useTranslation();
  return <p role="status" aria-live="polite" className="p-5 font-semibold">{t("a11y.loading")}</p>;
}
