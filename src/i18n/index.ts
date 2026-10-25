import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import enCommon from "./en/common.json";
import esCommon from "./es/common.json";
import koCommon from "./ko/common.json";
import enNotif from "./en/notifications.json";
import enCust from "./en/customer.json";
import enPro from "./en/professional.json";
import enPay from "./en/payments.json";
import enBr from "./en/branches.json";
import enCs from "./en/cases.json";
import enSp from "./en/support.json";
import enAd from "./en/admin.json";
import enDm from "./en/demo.json";
import esNotif from "./es/notifications.json";
import esCust from "./es/customer.json";
import esPro from "./es/professional.json";
import esPay from "./es/payments.json";
import esBr from "./es/branches.json";
import esCs from "./es/cases.json";
import esSp from "./es/support.json";
import esAd from "./es/admin.json";
import esDm from "./es/demo.json";
import koNotif from "./ko/notifications.json";
import koCust from "./ko/customer.json";
import koPro from "./ko/professional.json";
import koPay from "./ko/payments.json";
import koBr from "./ko/branches.json";
import koCs from "./ko/cases.json";
import koSp from "./ko/support.json";
import koAd from "./ko/admin.json";
import koDm from "./ko/demo.json";
import { config, type Lang } from "@/core/config/fixx.config";

type Entry = { text: string; status: string; needsNativeReview?: boolean };
const flat = (...ds: Record<string, Entry>[]) =>
  Object.fromEntries(ds.flatMap((d) => Object.entries(d).map(([k, v]) => [k, v.text])));

/** Auto-detect from device; fall back to English. */
export function detectLanguage(): Lang {
  const prefs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const p of prefs) {
    const base = p.toLowerCase().split("-")[0] as Lang;
    if ((config.languages as readonly string[]).includes(base)) return base;
  }
  return config.fallbackLanguage;
}

export const localeFor: Record<Lang, string> = { en: "en-US", es: "es-MX", ko: "ko-KR" };
export const languageNames: Record<Lang, string> = { en: "English", es: "Español", ko: "한국어" };

void i18n.use(ICU).use(initReactI18next).init({
  resources: {
    en: { translation: flat(enCommon as Record<string, Entry>, enNotif as Record<string, Entry>, enCust as Record<string, Entry>, enPro as Record<string, Entry>, enPay as Record<string, Entry>, enBr as Record<string, Entry>, enCs as Record<string, Entry>, enSp as Record<string, Entry>, enAd as Record<string, Entry>, enDm as Record<string, Entry>) },
    es: { translation: flat(esCommon as Record<string, Entry>, esNotif as Record<string, Entry>, esCust as Record<string, Entry>, esPro as Record<string, Entry>, esPay as Record<string, Entry>, esBr as Record<string, Entry>, esCs as Record<string, Entry>, esSp as Record<string, Entry>, esAd as Record<string, Entry>, esDm as Record<string, Entry>) },
    ko: { translation: flat(koCommon as Record<string, Entry>, koNotif as Record<string, Entry>, koCust as Record<string, Entry>, koPro as Record<string, Entry>, koPay as Record<string, Entry>, koBr as Record<string, Entry>, koCs as Record<string, Entry>, koSp as Record<string, Entry>, koAd as Record<string, Entry>, koDm as Record<string, Entry>) }
  },
  lng: detectLanguage(),
  fallbackLng: config.fallbackLanguage,
  keySeparator: false,
  interpolation: { escapeValue: false }
});

export default i18n;
