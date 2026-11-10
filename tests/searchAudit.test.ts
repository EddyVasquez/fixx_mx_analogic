import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchServices } from "../src/features/customer/searchIndex";

function view(query: string, lang: "en" | "es" | "ko" = "en") {
  const result = searchServices(query, lang);
  const names = (tier: "strong" | "soft") => Object.entries(result.trades).filter(([, value]) => value === tier).map(([id]) => id).sort();
  return {
    status: result.status,
    safety: result.safety,
    strong: names("strong"),
    soft: names("soft"),
    chips: result.chips.map((chip) => `${chip.taskId}${chip.pendingReview ? "*" : ""}`)
  };
}

const bath = ["cleaning", "electrical", "flooring", "handyman", "painting", "plumbing"];

describe("smart search audit", () => {
  it("A1 window alone is glass and cleaning, never bars or locksmith", () => {
    for (const query of ["window", "windows", "ventana", "창문"]) {
      const found = view(query);
      expect(found.strong, query).toEqual([]);
      expect(found.soft, query).toEqual(["cleaning", "handyman"]);
      expect(found.chips, query).toEqual(["FIXX-HND-004", "FIXX-CLN-007"]);
    }
    expect(view("window cleaning").strong).toEqual(["cleaning"]);
    expect(view("window cleaning").chips).toEqual(["FIXX-CLN-007"]);
    expect(view("broken window").strong).toEqual(["handyman"]);
    expect(view("broken window").chips).toEqual(["FIXX-HND-003", "FIXX-HND-004"]);
    expect(view("window glass broken").chips[0]).toBe("FIXX-HND-003");
    expect(view("window glass broken").chips.join(" ")).not.toContain("MTL");
    expect(view("rejas").strong).toEqual(["metalwork"]);
    expect(view("rejas").chips).toEqual(["FIXX-MTL-001"]);
    expect(view("protecciones").soft).toEqual([]);
  });

  it("A2 and A3 a room alone stays a soft list", () => {
    expect(view("I need help with my downstairs bathroom").soft).toEqual(bath);
    expect(view("bathroom").strong).toEqual([]);
    expect(view("baño", "es").soft).toEqual(bath);
    expect(view("화장실", "ko").soft).toEqual(bath);
    expect(view("kitchen and bathroom").strong).toEqual([]);
    expect(view("kitchen and bathroom").soft).toEqual(expect.arrayContaining(["plumbing", "appliance", "carpentry"]));
    expect(view("door").strong).toEqual([]);
    expect(view("door").soft).toEqual(expect.arrayContaining(["carpentry", "locksmith", "metalwork"]));
    expect(view("garage door").strong).toEqual([]);
    expect(view("garage door").soft).toEqual(expect.arrayContaining(["metalwork", "carpentry"]));
    expect(view("closet").strong).toEqual([]);
    expect(view("ceiling").soft).toEqual(expect.arrayContaining(["painting", "roofing"]));
    expect(view("walls").soft).toEqual(expect.arrayContaining(["painting", "concrete"]));
    expect(view("roof").strong).toEqual([]);
    expect(view("roof").soft[0]).toBeDefined();
    expect(view("techo", "es").strong).toEqual([]);
  });

  it("A4 a specific word turns the room list off", () => {
    expect(view("bathroom light").strong).toEqual(["electrical"]);
    expect(view("bathroom light").soft).toEqual([]);
    expect(view("bathroom door").strong).toEqual([]);
    expect(view("rejas para ventana").strong).toEqual(["metalwork"]);
    expect(view("rejas para ventana").soft).toEqual([]);
    expect(view("ceiling leak").strong).toEqual(["plumbing"]);
    expect(view("ceiling leak").soft).toEqual([]);
    expect(view("kitchen floor").strong).toEqual(["flooring"]);
  });

  it("A5 Spanish display-name words do not hijack a trade", () => {
    expect(view("patio").strong).toEqual([]);
    expect(view("patio").soft).toEqual(expect.arrayContaining(["gardening", "concrete"]));
    expect(view("patio").soft).not.toEqual(["concrete"]);
    expect(view("cochera").strong).toEqual([]);
    expect(view("cochera").chips.join(" ")).not.toContain("MTL-005");
    expect(view("ventilador de techo").strong).toEqual(["electrical"]);
    expect(view("ventilador de techo").soft).toEqual([]);
    expect(view("mantenimiento").status).toBe("idle");
    expect(view("control remoto").status).toBe("idle");
    expect(view("general cleaning").strong).toEqual(["cleaning"]);
    expect(view("general cleaning").soft).toEqual([]);
  });

  it("A6 generic verbs light nothing", () => {
    for (const query of ["repair", "install", "fix", "arreglar", "reparar", "instalar", "visita", "cambio", "설치"]) {
      expect(view(query).status, query).toBe("idle");
    }
    expect(view("toilet repair").strong).toEqual(["plumbing"]);
    expect(view("toilet repair").chips).toEqual(["FIXX-PLM-001"]);
    expect(view("door repair").strong).toEqual([]);
    expect(view("tile repair").strong).toEqual(["flooring"]);
    expect(view("tile repair").soft).toEqual([]);
  });

  it("A7 water stays plumbing", () => {
    for (const query of ["water", "water heater", "hot water", "water leak", "cold water"]) {
      const found = view(query);
      expect(found.strong, query).toEqual(["plumbing"]);
      expect(found.chips.join(" "), query).not.toContain("ROF");
    }
    expect(view("water heater").chips[0]).toBe("FIXX-PLM-004");
    expect(view("waterproof").strong).toEqual(["roofing"]);
  });

  it("A8 and A9 near-misses and slang magnets stay quiet", () => {
    for (const query of ["sin", "rato", "ratos", "tape", "set", "see", "not", "now", "not working", "nos"]) {
      expect(view(query).status, query).not.toBe("hit");
    }
    expect(view("papel tapiz").strong).toEqual(["painting"]);
    expect(view("papel tapiz").chips.join(" ")).not.toContain("PLM");
    expect(view("seal concrete").strong).toEqual(["concrete"]);
    expect(view("seal concrete").chips[0]).toBe("FIXX-CON-003");
    expect(view("sin luz").strong).toEqual(["electrical"]);
  });

  it("A10 one word of a phrase is not the whole job", () => {
    expect(view("shower").strong).toEqual(["plumbing"]);
    expect(view("shower").chips).toEqual(["FIXX-PLM-007"]);
    expect(view("security").status).not.toBe("hit");
    expect(view("split").status).not.toBe("hit");
    expect(view("ligera").status).not.toBe("hit");
    expect(view("templado").status).not.toBe("hit");
    expect(view("screen door").chips.join(" ")).not.toContain("HND-003");
  });

  it("A11 and A12 filler and storey words inside titles do not leak back", () => {
    for (const query of ["home", "my home", "casa", "mi casa", "house", "salida", "solo", "interior", "budget"]) {
      expect(view(query).status, query).not.toBe("hit");
    }
    expect(view("house cleaning").strong).toEqual(["cleaning"]);
    expect(view("patio de la casa").soft).toEqual(view("patio").soft);
    expect(view("la taza no baja").strong).toEqual(["plumbing"]);
    expect(view("la taza no baja").chips).toEqual(["FIXX-PLM-001"]);
    expect(view("no le baja al baño").chips).toEqual(["FIXX-PLM-001"]);
    expect(view("planta baj").status).toBe("idle");
  });

  it("A13 laundry room stays a room", () => {
    const found = view("cuarto de lavado");
    expect(found.strong).toEqual([]);
    expect(found.soft).toEqual(["appliance", "cleaning", "electrical", "handyman", "plumbing"]);
  });

  it("A14 the object beats the symptom", () => {
    expect(view("el refri no enfría").strong).toEqual(["appliance"]);
    expect(view("el refri no enfría").chips).toEqual(["FIXX-APL-002*"]);
    expect(view("el minisplit gotea").strong).toEqual(["hvac"]);
    expect(view("el minisplit gotea").chips.join(" ")).not.toContain("PLM");
    expect(view("la regadera gotea").strong).toEqual(["plumbing"]);
    expect(view("la regadera gotea").chips).toEqual(["FIXX-PLM-007"]);
    expect(view("la regadera gotea").soft).not.toContain("roofing");
  });

  it("A15 gas is a safety state and never a booking or an empty search", () => {
    for (const query of ["gas", "gas leak", "fuga de gas", "olor a gas", "huele a gas", "가스", "가스 누출"]) {
      const found = view(query);
      expect(found.status, query).toBe("safety");
      expect(found.safety, query).toBe("gas");
      expect(found.strong, query).toEqual([]);
      expect(found.soft, query).toEqual([]);
      expect(found.chips, query).toEqual([]);
    }
  });

  it("A16 a front door is a door, not a locksmith job", () => {
    for (const query of ["front door", "puerta principal", "entrada principal"]) {
      expect(view(query).strong, query).toEqual([]);
      expect(view(query).soft, query).toEqual(expect.arrayContaining(["carpentry", "locksmith"]));
    }
    expect(view("locked out").strong).toEqual(["locksmith"]);
    expect(view("chapa").strong).toEqual(["locksmith"]);
  });

  it("B1 everyday words that were missing", () => {
    expect(view("humedad").soft).toEqual(["painting", "plumbing", "roofing"]);
    expect(view("cabinet").strong).toEqual(["carpentry"]);
    expect(view("kitchen cabinets").strong).toEqual(["carpentry"]);
    expect(view("doorbell").strong).toEqual(["electrical"]);
    expect(view("lightbulb").strong).toEqual(["electrical"]);
    expect(view("wallpaper").strong).toEqual(["painting"]);
    expect(view("barda").strong).toEqual(["concrete"]);
    expect(view("mosquitero").strong).toEqual(["handyman"]);
    expect(view("방충망", "ko").strong).toEqual(["handyman"]);
    expect(view("물이 새요", "ko").strong).toEqual(["plumbing"]);
    expect(view("timbre").strong).toEqual(["electrical"]);
    expect(view("hot").soft).toEqual(["hvac", "plumbing"]);
    expect(view("cold").soft).toEqual(["hvac", "plumbing"]);
  });

  it("B2 the narrower room's chip comes first", () => {
    expect(view("bathroom door").chips[0]).toBe("FIXX-CAR-001");
    expect(view("puerta del baño").chips[0]).toBe("FIXX-CAR-001");
    expect(view("I need help with my downstairs bathroom windows").chips[0]).toBe("FIXX-HND-004");
    expect(view("I need help with my downstairs bathroom windows").soft).not.toContain("metalwork");
  });

  it("B3 a broken window suggests the glass job", () => {
    expect(view("ventana rota").chips).toEqual(["FIXX-HND-003", "FIXX-HND-004"]);
    expect(view("ventanas rotas").chips[0]).toBe("FIXX-HND-003");
  });

  it("B4 a 220 circuit suggests the dedicated circuit job", () => {
    expect(view("circuito 220").chips[0]).toBe("FIXX-ELC-004*");
    expect(view("220 v").chips[0]).toBe("FIXX-ELC-004*");
    expect(view("minisplit circuit").chips[0]).toBe("FIXX-ELC-004*");
  });

  it("B5 an exhaust fan is not a ceiling fan", () => {
    expect(view("bathroom fan").strong).toEqual(["electrical"]);
    expect(view("bathroom fan").chips).toEqual([]);
    expect(view("exhaust fan").chips).toEqual([]);
    expect(view("ceiling fan").chips[0]).toBe("FIXX-ELC-003*");
  });

  it("C1 and C2 half-typed filler and storey words stay idle", () => {
    for (const query of ["nec", "nece", "hel", "ayu", "quier", "I need help with my dow", "second fl", "segundo pi", "planta ba", "ground fl", "2nd fl", "piso de arr", "아래"]) {
      const found = view(query);
      expect(found.status, query).toBe("idle");
      expect(found.chips, query).toEqual([]);
    }
    expect(view("zzzz").status).toBe("empty");
    expect(view("second floor").status).toBe("idle");
    expect(view("I need help wi").status).toBe("idle");
  });

  it("C3 two letters only reach a head word or a trade name, and only softly", () => {
    expect(view("ex").status).toBe("idle");
    expect(view("te").status).toBe("idle");
    expect(view("co").status).toBe("idle");
    expect(view("ca").status).toBe("idle");
    expect(view("re").status).toBe("idle");
    expect(view("ma").status).toBe("idle");
    expect(view("wi").soft).toEqual(["cleaning", "handyman"]);
    expect(view("ba").soft).toEqual(bath);
    expect(view("pl").strong).toEqual([]);
    expect(view("pl").soft).toEqual(["plumbing"]);
    expect(view("my ki").soft).toEqual(expect.arrayContaining(["appliance", "plumbing"]));
  });

  it("C4 a fixture does not drag in the whole bathroom", () => {
    expect(view("toilet").strong).toEqual(["plumbing"]);
    expect(view("toilet").soft).toEqual([]);
    expect(view("faucet").soft).toEqual([]);
    expect(view("leak").soft).not.toContain("roofing");
    expect(view("bars").soft).toEqual([]);
  });

  it("C5 room lists a homeowner would expect", () => {
    expect(view("bedroom").soft).not.toContain("appliance");
    expect(view("bedroom").soft).not.toContain("locksmith");
    expect(view("hallway").soft).not.toContain("locksmith");
    expect(view("entrada de coches").soft).toEqual(view("garage").soft);
    expect(view("balcony").soft).not.toContain("roofing");
  });

  it("C6 there is one dictionary", () => {
    expect(existsSync("src/features/customer/searchSlang.json")).toBe(false);
  });

  it("C7 a carport stays on its own words, and a panel stays bookable", () => {
    expect(view("carport").chips).toEqual(["FIXX-MTL-005*"]);
    expect(view("cochera ligera").chips).toEqual(["FIXX-MTL-005*"]);
    expect(view("cochera").chips.join(" ")).not.toContain("MTL-005");
    expect(view("structural crack").chips.join(" ")).not.toContain("MTL-005");
    expect(view("structural crack").strong).toEqual(["concrete"]);
    const panel = view("electrical panel");
    expect(panel.strong).toEqual(["electrical"]);
    expect(panel.chips).toEqual(["FIXX-ELC-005"]);
    expect(view("centro de carga").chips[0]).toBe("FIXX-ELC-005");
    expect(view("breaker panel").chips[0]).toBe("FIXX-ELC-005");
    expect(view("tablero").chips[0]).toBe("FIXX-ELC-005");
  });

  it("routes an electric shower away from the plumbing shower job", () => {
    expect(view("regadera eléctrica").strong).toEqual(["electrical"]);
    expect(view("regadera eléctrica").chips).toEqual([]);
    expect(view("electric shower").strong).toEqual(["electrical"]);
    expect(view("electric shower").chips).not.toContain("FIXX-PLM-007");
    expect(view("mezcladora").chips).toEqual(["FIXX-PLM-007"]);
    expect(view("monomando").chips).toEqual(["FIXX-PLM-007"]);
    expect(view("shower head").chips).toEqual(["FIXX-PLM-007"]);
  });
});
