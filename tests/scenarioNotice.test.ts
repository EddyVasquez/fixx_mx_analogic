import { describe, it, expect } from "vitest";
import { scenarioNoticeText, type ScenarioNotice } from "../src/demo/scenarioNotice";

const dictionaries: Record<string, Record<string, string>> = {
  en: {
    "scenario.handoff": "Ready. You are now the {role}. Try the next step yourself.",
    "scenario.finished": "Done. The scenario ran to the end.",
    "scenario.notStarted": "Start the scenario first.",
    "roles.customer": "Customer"
  },
  es: {
    "scenario.handoff": "Listo. Ahora eres {role}. Prueba el siguiente paso tú mismo.",
    "scenario.finished": "Listo. El escenario llegó hasta el final.",
    "scenario.notStarted": "Primero inicia el escenario.",
    "roles.customer": "Cliente"
  }
};

const tFor = (lang: string) => (key: string, options?: Record<string, unknown>) => {
  let text = dictionaries[lang]?.[key] ?? key;
  for (const [name, value] of Object.entries(options ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
};

describe("scenario notice follows the current language", () => {
  const handoff: ScenarioNotice = { kind: "handoff", role: "customer" };

  it("translates the same handoff again after the language changes", () => {
    expect(scenarioNoticeText(handoff, tFor("en"))).toBe("Ready. You are now the Customer. Try the next step yourself.");
    expect(scenarioNoticeText(handoff, tFor("es"))).toBe("Listo. Ahora eres Cliente. Prueba el siguiente paso tú mismo.");
  });

  it("translates the finished and not-started notes", () => {
    expect(scenarioNoticeText({ kind: "finished" }, tFor("es"))).toBe("Listo. El escenario llegó hasta el final.");
    expect(scenarioNoticeText({ kind: "notStarted" }, tFor("es"))).toBe("Primero inicia el escenario.");
  });
});
