import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { useRuntime } from "@/demo/runtime";
import { inputClass } from "@/ui/Field";
import {
  CasesSection, HomeownersSection, JobsSection, NotesSection, ProfessionalsSection, QualitySection,
  QuotesSection, RefundsSection, RequestsSection, StandardsSection, VerificationSection, WarrantiesSection
} from "./sections";

const SECTIONS = {
  requests: RequestsSection, homeowners: HomeownersSection, professionals: ProfessionalsSection, verification: VerificationSection,
  jobs: JobsSection, quotes: QuotesSection, standards: StandardsSection, cases: CasesSection, warranties: WarrantiesSection,
  refunds: RefundsSection, quality: QualitySection, notes: NotesSection
} as const;
type Section = keyof typeof SECTIONS;

/** FIXX staff console. English and Spanish only. */
export function AdminApp() {
  const { t, i18n } = useTranslation();
  const rt = useRuntime();
  const [section, setSection] = useState<Section>("requests");
  const Current = SECTIONS[section];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("admin.title")}</h2>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("admin.section")}
        <select className={inputClass} value={section} onChange={(e) => setSection(e.target.value as Section)}>
          {(Object.keys(SECTIONS) as Section[]).map((s) => <option key={s} value={s}>{t(`admin.s.${s}`)}</option>)}
        </select>
      </label>
      <Current rt={rt} lang={i18n.language as Lang} />
    </div>
  );
}
