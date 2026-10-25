import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const SIZES = [100, 125, 150] as const;
const read = (): number => {
  try { const v = Number(localStorage.getItem("fixx.scale")); return [100, 125, 150].includes(v) ? v : 100; } catch { return 100; }
};

/** Magnification + high contrast. Applies to the whole app via <html>. */
export function A11yControl() {
  const { t } = useTranslation();
  const [scale, setScale] = useState<number>(read);
  const [high, setHigh] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale}%`;
    try { localStorage.setItem("fixx.scale", String(scale)); } catch { /* storage unavailable */ }
  }, [scale]);
  useEffect(() => { document.documentElement.dataset.contrast = high ? "high" : "normal"; }, [high]);

  const names: Record<number, string> = { 100: t("a11y.size100"), 125: t("a11y.size125"), 150: t("a11y.size150") };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{t("a11y.title")}</legend>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("a11y.textSize")}>
        {SIZES.map((s) => (
          <button key={s} type="button" aria-pressed={scale === s} onClick={() => setScale(s)}
            className={`min-h-touch min-w-touch rounded-full border-2 border-ink px-4 text-sm font-semibold ${scale === s ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
            {names[s]}
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={high} onClick={() => setHigh(!high)}
        className={`min-h-touch rounded-full border-2 border-ink px-4 text-sm font-semibold ${high ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
        {t("a11y.contrast")}: {high ? t("a11y.on") : t("a11y.off")}
      </button>
    </fieldset>
  );
}
