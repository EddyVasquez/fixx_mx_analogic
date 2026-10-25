import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Accessible data table: a caption for screen readers, column headers with scope, horizontal scroll on narrow screens. */
export function Table({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return <p className="rounded-2xl border border-line bg-paper p-4">{t("admin.empty")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} scope="col" className="border-b-2 border-ink p-2 font-bold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line p-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
