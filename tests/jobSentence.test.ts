import { describe, expect, it } from "vitest";
import { buildJobSentence, spanishConjunction, type SentenceJob } from "../src/features/customer/jobSentence";

const en: SentenceJob[] = [
  { label: "Fix a leaking faucet" },
  { label: "Replace the toilet flapper" },
  { label: "Install a shutoff valve" }
];

const es: SentenceJob[] = [
  { label: "Reparar una llave que gotea" },
  { label: "Cambiar el empaque del tanque" },
  { label: "Instalar una válvula" }
];

const ko: SentenceJob[] = [
  { label: "새는 수도꼭지 수리" },
  { label: "변기 플래퍼 교체" },
  { label: "밸브 설치" }
];

describe("job sentences", () => {
  it("joins English with and, an Oxford comma, and a lower-case follow-on", () => {
    expect(buildJobSentence(en.slice(0, 1), "en")).toBe("Fix a leaking faucet.");
    expect(buildJobSentence(en.slice(0, 2), "en")).toBe("Fix a leaking faucet and replace the toilet flapper.");
    expect(buildJobSentence(en, "en")).toBe("Fix a leaking faucet, replace the toilet flapper, and install a shutoff valve.");
  });

  it("joins Spanish with y, no comma before y, and e before an i sound", () => {
    expect(buildJobSentence(es.slice(0, 1), "es")).toBe("Reparar una llave que gotea.");
    expect(buildJobSentence([es[0]!, es[1]!], "es")).toBe("Reparar una llave que gotea y cambiar el empaque del tanque.");
    expect(buildJobSentence([es[0]!, es[2]!], "es")).toBe("Reparar una llave que gotea e instalar una válvula.");
    expect(buildJobSentence(es, "es")).toBe("Reparar una llave que gotea, cambiar el empaque del tanque e instalar una válvula.");
  });

  it("joins Korean with 및, leaves spelling alone, and ends with a period", () => {
    expect(buildJobSentence(ko.slice(0, 1), "ko")).toBe("새는 수도꼭지 수리.");
    expect(buildJobSentence(ko.slice(0, 2), "ko")).toBe("새는 수도꼭지 수리 및 변기 플래퍼 교체.");
    expect(buildJobSentence(ko, "ko")).toBe("새는 수도꼭지 수리, 변기 플래퍼 교체 및 밸브 설치.");
  });

  it("keeps a flagged acronym and capitalizes only the first letter of the sentence", () => {
    expect(buildJobSentence([{ label: "fix a leaking faucet" }], "en")).toBe("Fix a leaking faucet.");
    expect(buildJobSentence([
      { label: "Fix a leaking faucet" },
      { label: "TV wall mount", keepCase: true }
    ], "en")).toBe("Fix a leaking faucet and TV wall mount.");
    expect(buildJobSentence([
      { label: "Reparar una llave" },
      { label: "TV en pared", keepCase: true }
    ], "es")).toBe("Reparar una llave y TV en pared.");
  });

  it("uses e for an i or hi sound and y for a ye sound or accented í", () => {
    expect(spanishConjunction("instalar")).toBe("e");
    expect(spanishConjunction("historia")).toBe("e");
    expect(spanishConjunction("hielo")).toBe("y");
    expect(spanishConjunction("hiato")).toBe("y");
    expect(spanishConjunction("íntegra")).toBe("y");
    expect(buildJobSentence([{ label: "Reparar" }, { label: "Hielo en la tubería" }], "es")).toBe("Reparar y hielo en la tubería.");
  });

  it("writes one period and an empty sentence when nothing is selected", () => {
    expect(buildJobSentence([], "en")).toBe("");
    expect(buildJobSentence([{ label: "Fix a leaking faucet." }], "en")).toBe("Fix a leaking faucet.");
  });

  it("falls back to the same sentences when Intl.ListFormat is missing", () => {
    const original = Intl.ListFormat;
    Object.defineProperty(Intl, "ListFormat", { configurable: true, writable: true, value: undefined });
    try {
      expect(typeof Intl.ListFormat).not.toBe("function");
      expect(buildJobSentence(en, "en")).toBe("Fix a leaking faucet, replace the toilet flapper, and install a shutoff valve.");
      expect(buildJobSentence(es, "es")).toBe("Reparar una llave que gotea, cambiar el empaque del tanque e instalar una válvula.");
      expect(buildJobSentence([es[0]!, es[1]!], "es")).toBe("Reparar una llave que gotea y cambiar el empaque del tanque.");
      expect(buildJobSentence(ko, "ko")).toBe("새는 수도꼭지 수리, 변기 플래퍼 교체 및 밸브 설치.");
    } finally {
      Object.defineProperty(Intl, "ListFormat", { configurable: true, writable: true, value: original });
    }
  });

  it("still writes e when ListFormat leaves a y before an i sound", () => {
    const original = Intl.ListFormat;
    class AlwaysY {
      format(parts: string[]) {
        if (parts.length < 2) return parts.join("");
        if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
        return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
      }
    }
    Object.defineProperty(Intl, "ListFormat", { configurable: true, writable: true, value: AlwaysY });
    try {
      expect(buildJobSentence([es[0]!, es[2]!], "es")).toBe("Reparar una llave que gotea e instalar una válvula.");
      expect(buildJobSentence([es[0]!, es[1]!], "es")).toBe("Reparar una llave que gotea y cambiar el empaque del tanque.");
    } finally {
      Object.defineProperty(Intl, "ListFormat", { configurable: true, writable: true, value: original });
    }
  });
});
