import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTO_YAW_PER_SEC,
  SANTA_SOFIA,
  boundsOf,
  buildSantaSofia,
  modeledBuiltArea,
  shouldAutoRotate
} from "../src/features/customer/blueprint/houseModel";

const blueprintFiles = [
  "src/features/customer/blueprint/HouseBlueprint.tsx",
  "src/features/customer/blueprint/BlueprintFallback.tsx"
];

describe("Santa Sofía blueprint shell", () => {
  const shell = buildSantaSofia();
  const house = shell.parts.filter((part) => part.house);
  const center = boundsOf(house).center;
  const garage = shell.parts.filter((part) => part.role === "garage");
  const patio = shell.parts.find((part) => part.role === "patio");

  it("matches the two-story lot: about 6–7 m wide, 15 m deep, 100.49 m² built", () => {
    expect(SANTA_SOFIA.stories).toBe(2);
    expect(SANTA_SOFIA.houseWidth).toBeGreaterThanOrEqual(6);
    expect(SANTA_SOFIA.houseWidth).toBeLessThanOrEqual(7);
    expect(SANTA_SOFIA.lotDepth).toBe(15);
    expect(modeledBuiltArea()).toBe(100.49);
    expect(shell.builtM2).toBe(100.49);
  });

  it("centers the house on the origin and keeps the garage in front of the patio", () => {
    expect(center[0]).toBeCloseTo(0, 5);
    expect(center[1]).toBeCloseTo(0, 5);
    expect(center[2]).toBeCloseTo(0, 5);
    expect(shell.groundY).toBeLessThan(0);
    expect(shell.radius).toBeGreaterThan(3);
    expect(garage.length).toBeGreaterThanOrEqual(4);
    expect(garage.every((part) => part.position[1] < 0)).toBe(true);
    expect(patio).toBeTruthy();
    expect(patio!.position[2]).toBeGreaterThan(0);
    expect(garage.every((part) => part.position[2] < patio!.position[2])).toBe(true);
    for (const role of ["parapet", "pergola", "step", "balcony", "canopy", "mullion", "sill", "door", "window"] as const) {
      expect(shell.parts.some((part) => part.role === role)).toBe(true);
    }
    expect(shell.parts.some((part) => part.role === "wall" && Math.min(...part.size) >= 0.15 && Math.min(...part.size) <= 0.2)).toBe(true);
  });

  it("spins only around yaw, and only while idle", () => {
    expect(shouldAutoRotate(false, true, false)).toBe(true);
    expect(shouldAutoRotate(true, true, false)).toBe(false);
    expect(shouldAutoRotate(false, false, false)).toBe(false);
    expect(shouldAutoRotate(false, true, true)).toBe(false);
    expect(AUTO_YAW_PER_SEC).toBeGreaterThan(0);
    expect(AUTO_YAW_PER_SEC).toBeLessThan(0.5);
    const source = readFileSync(join(process.cwd(), "src/features/customer/blueprint/HouseBlueprint.tsx"), "utf8");
    expect(source).not.toMatch(/pitch|rotation\.x|clampPitch/);
    expect(source).toMatch(/LineSegments2/);
    expect(source).toMatch(/dpr=\{\[1, 2\]\}/);
    expect(source).toMatch(/antialias: true/);
  });

  it("uses only grey inks in the drawing", () => {
    const fallback = readFileSync(join(process.cwd(), blueprintFiles[1]!), "utf8");
    expect(fallback.match(/#[0-9A-Fa-f]{6}/g)?.length ?? 0).toBeGreaterThan(0);
    for (const file of blueprintFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const hex of source.match(/#[0-9A-Fa-f]{6}/g) ?? []) {
        const n = parseInt(hex.slice(1), 16);
        const red = (n >> 16) & 255;
        const green = (n >> 8) & 255;
        const blue = n & 255;
        expect(red).toBe(green);
        expect(green).toBe(blue);
      }
    }
  });
});
