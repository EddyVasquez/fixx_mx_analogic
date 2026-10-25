import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { translate } from "@/mocks/translation/translator";

/** Shows text in the viewer's language. Translated text says so and lets the viewer see the original. */
export function TranslatedText({ text, from, to }: { text: string; from: Lang; to: Lang }) {
  const { t } = useTranslation();
  const [showOriginal, setShowOriginal] = useState(false);
  const tr = translate(text, from, to);
  if (!tr.auto) return <span>{text}</span>;
  return (
    <span className="flex flex-col">
      <span>{showOriginal ? text : tr.text}</span>
      <span className="text-sm text-inkSoft">
        {t("translation.auto")}{" "}
        <button type="button" onClick={() => setShowOriginal(!showOriginal)} className="min-h-touch font-semibold underline">
          {showOriginal ? t("btn.hideOriginal") : t("btn.seeOriginal")}
        </button>
      </span>
    </span>
  );
}
