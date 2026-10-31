import { describe, expect, it } from "vitest";
import {
  AUTO_YAW_PER_SEC,
  PITCH_MAX,
  PITCH_MIN,
  SANTA_SOFIA,
  buildSantaSofia,
  clampPitch,
  modeledBuiltArea,
  shouldAutoRotate
} from "../src/features/customer/blueprint/houseModel";

describe("Santa Sofía blueprint shell", () => {
  const shell = buildSantaSofia();
  const body = shell.parts.find((part) => part.role === "body");
  const garage = shell.parts.find((part) => part.role === "garage");
  const patio = shell.parts.find((part) => part.role === "patio");

  it("matches the two-story lot: about 6–7 m wide, 15 m deep, 100.49 m² built", () => {
    expect(SANTA_SOFIA.stories).toBe(2);
    expect(SANTA_SOFIA.houseWidth).toBeGreaterThanOrEqual(6);
    expect(SANTA_SOFIA.houseWidth).toBeLessThanOrEqual(7);
    expect(SANTA_SOFIA.lotDepth).toBe(15);
    expect(modeledBuiltArea()).toBe(100.49);
    expect(shell.builtM2).toBe(100.49);
    expect(shell.roof.backHeight).toBeGreaterThan(shell.roof.frontHeight);
  });

  it("puts a ground-floor garage on the front, windows on the facades, and a patio behind", () => {
    expect(body).toBeTruthy();
    expect(garage).toBeTruthy();
    expect(patio).toBeTruthy();
    expect(garage!.position[2]).toBeLessThan(body!.position[2]);
    expect(garage!.position[1]).toBeLessThan(SANTA_SOFIA.floorHeight);
    expect(patio!.position[2]).toBeGreaterThan(body!.position[2]);
    expect(shell.parts.filter((part) => part.role === "window").length).toBeGreaterThanOrEqual(4);
    expect(shell.parts.some((part) => part.role === "door")).toBe(true);
  });

  it("spins only while idle, and keeps vertical tilt small", () => {
    expect(shouldAutoRotate(false, true, false)).toBe(true);
    expect(shouldAutoRotate(true, true, false)).toBe(false);
    expect(shouldAutoRotate(false, false, false)).toBe(false);
    expect(shouldAutoRotate(false, true, true)).toBe(false);
    expect(clampPitch(2)).toBe(PITCH_MAX);
    expect(clampPitch(-2)).toBe(PITCH_MIN);
    expect(PITCH_MAX - PITCH_MIN).toBeLessThan(Math.PI / 2);
    expect(AUTO_YAW_PER_SEC).toBeGreaterThan(0);
    expect(AUTO_YAW_PER_SEC).toBeLessThan(0.5);
  });
});
