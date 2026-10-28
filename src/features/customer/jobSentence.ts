import type { Lang } from "@/core/config/fixx.config";

/** One selected job, in the order the customer picked it. */
export interface SentenceJob {
  label: string;
  /** True when the label starts with a proper noun or an acronym and must keep that capital. */
  keepCase?: boolean;
}

const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-MX", ko: "ko-KR" };

/**
 * A readable sentence from the selected jobs, in selection order.
 * Uses Intl.ListFormat when the runtime has it, and the same join rules otherwise.
 * Spanish "y" becomes "e" before an i/hi sound. Korean keeps the original spelling.
 */
export function buildJobSentence(jobs: readonly SentenceJob[], lang: Lang): string {
  const parts = jobs
    .map((job, index) => prepareLabel(job, index, lang))
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "";
  const joined = formatList(parts, lang);
  return joined.endsWith(".") ? joined : `${joined}.`;
}

function prepareLabel(job: SentenceJob, index: number, lang: Lang): string {
  const text = job.label.trim().replace(/[.。]+$/u, "");
  if (!text || lang === "ko") return text;
  const locale = LOCALE[lang];
  if (index === 0) return mapFirstLetter(text, (ch) => ch.toLocaleUpperCase(locale));
  if (job.keepCase) return text;
  return mapFirstLetter(text, (ch) => ch.toLocaleLowerCase(locale));
}

function mapFirstLetter(text: string, change: (ch: string) => string): string {
  const match = /^(\s*)(\p{L})/u.exec(text);
  if (!match) return text;
  return `${match[1] ?? ""}${change(match[2] ?? "")}${text.slice(match[0].length)}`;
}

function formatList(parts: readonly string[], lang: Lang): string {
  if (typeof Intl.ListFormat === "function") {
    const formatted = new Intl.ListFormat(LOCALE[lang], { type: "conjunction", style: "long" }).format([...parts]);
    return lang === "es" ? forceSpanishE(formatted, parts) : formatted;
  }
  return fallbackJoin(parts, lang);
}

function fallbackJoin(parts: readonly string[], lang: Lang): string {
  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1) return last;
  if (lang === "ko") {
    if (parts.length === 2) return `${parts[0] ?? ""} 및 ${last}`;
    return `${parts.slice(0, -1).join(", ")} 및 ${last}`;
  }
  if (lang === "es") {
    const conj = spanishConjunction(last);
    if (parts.length === 2) return `${parts[0] ?? ""} ${conj} ${last}`;
    return `${parts.slice(0, -1).join(", ")} ${conj} ${last}`;
  }
  if (parts.length === 2) return `${parts[0] ?? ""} and ${last}`;
  return `${parts.slice(0, -1).join(", ")}, and ${last}`;
}

/** ListFormat already writes "e" in current engines. This keeps the rule if a runtime still writes "y". */
function forceSpanishE(formatted: string, parts: readonly string[]): string {
  const last = parts[parts.length - 1];
  if (!last || spanishConjunction(last) !== "e") return formatted;
  const at = formatted.lastIndexOf(last);
  if (at <= 0) return formatted;
  const before = formatted.slice(0, at);
  if (!/ y $/.test(before)) return formatted;
  return `${before.replace(/ y $/, " e ")}${formatted.slice(at)}`;
}

/**
 * "e" before an i/hi sound ("e instalar"), "y" before a ye/ya sound ("y hielo", "y hiato")
 * and before an accented í ("y íntegra"). Matches Intl.ListFormat("es-MX").
 */
export function spanishConjunction(next: string): "e" | "y" {
  const word = /^\s*([\p{L}\p{N}]+)/u.exec(next)?.[1]?.toLocaleLowerCase("es-MX") ?? "";
  if (!word) return "y";
  if (/^í/u.test(word) || /^hí/u.test(word)) return "y";
  if (/^hi[aeáé]/u.test(word)) return "y";
  if (/^i/u.test(word) || /^hi/u.test(word)) return "e";
  return "y";
}
