import { useTranslation } from "react-i18next";
import { completionItems } from "@/core/rules";

/** The same list for the professional (from the start of the job) and the customer (optional at the end). */
export function CompletionChecklist({ categoryId, checks, onToggle, optionalNote }: {
  categoryId: string;
  checks: Record<string, boolean>;
  onToggle?: (id: string, checked: boolean) => void;
  optionalNote?: string;
}) {
  const { t } = useTranslation();
  const items = completionItems(categoryId);
  const core = items.filter((i) => i.group === "core");
  const trade = items.filter((i) => i.group === "trade");
  const group = (title: string, list: typeof items) => (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-semibold">{title}</legend>
      {list.map((item) => (
        <label key={item.id} className="flex min-h-touch items-center gap-3">
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={!!checks[item.id]}
            disabled={!onToggle}
            onChange={(e) => onToggle?.(item.id, e.target.checked)}
          />
          {t(`check.${item.id}`)}
        </label>
      ))}
    </fieldset>
  );
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold">{t("completion.checklist")}</h3>
      {optionalNote && <p className="text-sm text-inkSoft">{optionalNote}</p>}
      {group(t("completion.core"), core)}
      {trade.length > 0 && group(t("completion.trade"), trade)}
    </div>
  );
}
