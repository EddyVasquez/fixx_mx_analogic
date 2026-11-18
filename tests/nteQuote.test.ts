import { describe, expect, it } from "vitest";
import { materialsPrice, revenue, roundMoney } from "../src/config/revenue";
import { CARD_FEE_IVA } from "../src/config/revenue";
import { buildQuote, estimateRange, humanReviewForCategory } from "../src/core/pricing/quote";
import { HOME_MODELS, SANTA_SOFIA_MODEL, measurementsFromHome } from "../src/features/customer/homeModel";

describe("not-to-exceed quote", () => {
  it("shows one price, the top of the scope, with the pricing math unchanged", () => {
    const range = estimateRange("painting", false);
    const quote = buildQuote("painting", false);
    expect(range.nteTotal).toBe(range.high);
    expect(quote.nteTotal).toBe(range.high);
    expect(quote.total).toBe(quote.nteTotal);
    expect(range.low).toBeLessThan(quote.nteTotal);
    expect(quote.lines.map((line) => line.id)).not.toContain("commission");
    expect(roundMoney(quote.lines.reduce((sum, line) => sum + line.amount, 0))).toBe(quote.nteTotal);

    const divisor = 1 - revenue.cardFeePct * CARD_FEE_IVA;
    expect(revenue.proCommission).toBe(0.15);
    expect(revenue.materialsMarkup).toBe(0.05);
    expect(revenue.cardFeePct).toBe(0.036);
    expect(CARD_FEE_IVA).toBe(1.16);
    expect(materialsPrice(100)).toBe(roundMoney(100 * 1.05 / divisor));
    expect(quote.total).toBe(roundMoney(quote.materials + quote.labor + quote.bookingFee));
  });

  it("keeps regulated work in review and still shows centavos", () => {
    expect(humanReviewForCategory("pest_control").some((item) => item.reason === "regulated")).toBe(true);
    const quote = buildQuote("metalwork", false, { taskIds: ["FIXX-MTL-001"] });
    expect(quote.pendingQuotes).toBe(false);
    expect(quote.nteTotal).toBe(quote.total);
    expect(quote.nteTotal).not.toBe(Math.round(quote.nteTotal));
  });

  it("takes square meters and minisplits from the Santa Sofía model", () => {
    expect(SANTA_SOFIA_MODEL).toMatchObject({ stories: 2, builtM2: 100.49, minisplits: 1 });
    expect(SANTA_SOFIA_MODEL.groundFullBathrooms + SANTA_SOFIA_MODEL.upperFullBathrooms).toBe(2);
    expect(measurementsFromHome("santa-sofia")).toEqual({ cleaningTier: "101–150 m²", minisplits: 1 });
    const fromModel = buildQuote("cleaning", false, { homeModelId: "santa-sofia", taskIds: ["FIXX-CLN-001"] });
    const fromFacts = buildQuote("cleaning", false, { cleaningTier: "101–150 m²", minisplits: 1, taskIds: ["FIXX-CLN-001"] });
    expect(fromModel.tier).toBe("101–150 m²");
    expect(fromModel.nteTotal).toBe(fromFacts.nteTotal);
    expect(fromModel.materials).toBe(fromFacts.materials);
    expect(fromModel.labor).toBe(fromFacts.labor);
    expect(fromModel.bookingFee).toBe(fromFacts.bookingFee);
  });

  it("keeps the two unmeasured plans out of the price", () => {
    const placeholders = HOME_MODELS.filter((model) => model.todo);
    expect(placeholders.map((model) => model.id)).toEqual(["todo-model-2", "todo-model-3"]);
    expect(measurementsFromHome("todo-model-2")).toBeNull();
    const small = buildQuote("cleaning", false, { homeModelId: "todo-model-2", cleaningTier: "≤60 m²", taskIds: ["FIXX-CLN-001"] });
    expect(small.tier).toBe("≤60 m²");
    expect(small.nteTotal).not.toBe(buildQuote("cleaning", false, { homeModelId: "santa-sofia", taskIds: ["FIXX-CLN-001"] }).nteTotal);
  });
});
