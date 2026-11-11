import { describe, expect, it } from "vitest";
import { hidesForCutaway, matchesFact, usesCutaway } from "../src/features/customer/blueprint/houseFocus";
import { fitCameraOnce, projectedNdc, yawToFace } from "../src/features/customer/blueprint/houseModel";

const NAMES = [
  "GarageDoor_Panel_1", "Site_Driveway", "Ground_Wall_Interior_Garage",
  "Minisplit_Condenser", "Minisplit_Indoor_MainBed",
  "Upper_MainBed_BalconyDoor_FrameL", "Upper_Bed2_Window_Sill", "Upper_Bed3_Window_Glass", "Upper_Wall_Interior_Bed23",
  "Ground_Wall_Interior_Bath", "Upper_Wall_Interior_Bath",
  "Ground_Slab", "Upper_Slab.001",
  "Roof_Slab", "Upper_Wall_Front", "Site_Lot"
];

describe("house fact focus", () => {
  it("matches the named spaces and cuts the roof away for interior rooms", () => {
    expect(NAMES.filter((name) => matchesFact(name, "garage"))).toEqual([
      "GarageDoor_Panel_1", "Site_Driveway", "Ground_Wall_Interior_Garage"
    ]);
    expect(NAMES.filter((name) => matchesFact(name, "minisplits"))).toEqual([
      "Minisplit_Condenser", "Minisplit_Indoor_MainBed"
    ]);
    expect(NAMES.filter((name) => matchesFact(name, "bedrooms"))).toEqual([
      "Upper_MainBed_BalconyDoor_FrameL", "Upper_Bed2_Window_Sill", "Upper_Bed3_Window_Glass", "Upper_Wall_Interior_Bed23"
    ]);
    expect(NAMES.filter((name) => matchesFact(name, "bathrooms"))).toEqual([
      "Ground_Wall_Interior_Bath", "Upper_Wall_Interior_Bath"
    ]);
    expect(matchesFact("Ground_Slab", "built")).toBe(true);
    expect(matchesFact("Upper_Slab.001", "built")).toBe(true);
    expect(matchesFact("Site_Lot", "built")).toBe(false);
    expect(matchesFact("Ground_Wall_Front", "stories")).toBe(true);
    expect(matchesFact("Roof_Slab", "stories")).toBe(false);
    expect(usesCutaway("bedrooms")).toBe(true);
    expect(usesCutaway("bathrooms")).toBe(true);
    expect(usesCutaway("garage")).toBe(false);
    expect(hidesForCutaway("Roof_Slab")).toBe(true);
    expect(hidesForCutaway("Upper_Wall_Front")).toBe(true);
    expect(hidesForCutaway("Upper_Wall_Interior_Bed23")).toBe(false);
  });

  it("frames a small box and can shift it to the right of a left HUD", () => {
    const min = { x: 2, y: 0, z: 1 };
    const max = { x: 3, y: 1, z: 2 };
    const centered = fitCameraOnce(min, max, 1.6, 0);
    const biased = fitCameraOnce(min, max, 1.6, 0.34);
    const center = { x: 2.5, y: 0.5, z: 1.5 };
    const mid = projectedNdc(center, centered, 1.6);
    const side = projectedNdc(center, biased, 1.6);
    expect(Math.abs(mid.x)).toBeLessThan(0.08);
    expect(side.x).toBeGreaterThan(0.2);
    expect(yawToFace({ x: 0, y: 1, z: 1 })).toBeTypeOf("number");
  });
});