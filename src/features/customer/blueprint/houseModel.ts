/**
 * Stylized Santa Sofía shell, in meters. A two-story rowhouse on a lot about
 * 6.6 m wide and 15 m deep. The built area is the floor plate times two stories
 * (6.5 × 7.73 × 2 = 100.49). This is not a survey and not a copy of any photo.
 */
export const SANTA_SOFIA = {
  stories: 2,
  lotWidth: 6.6,
  lotDepth: 15,
  houseWidth: 6.5,
  houseDepth: 7.73,
  floorHeight: 3,
  frontSetback: 0.6,
  patioDepth: 4.2,
  builtM2: 100.49,
  garageWidth: 2.6,
  garageHeight: 2.2
} as const;

export type BoxRole = "body" | "band" | "patio" | "garage" | "door" | "window";

export interface BoxPart {
  id: string;
  role: BoxRole;
  size: [number, number, number];
  position: [number, number, number];
}

export interface RoofSpec {
  width: number;
  depth: number;
  frontHeight: number;
  backHeight: number;
  position: [number, number, number];
}

export interface SantaSofiaShell {
  lotWidth: number;
  lotDepth: number;
  stories: number;
  builtM2: number;
  parts: BoxPart[];
  roof: RoofSpec;
}

export function modeledBuiltArea(spec: typeof SANTA_SOFIA = SANTA_SOFIA): number {
  return Math.round(spec.houseWidth * spec.houseDepth * spec.stories * 100) / 100;
}

/** Gentle spin while nobody is dragging. Off when the person asked for less motion. */
export function shouldAutoRotate(reducedMotion: boolean, idle: boolean, dragging: boolean): boolean {
  return !reducedMotion && idle && !dragging;
}

/** A little vertical tilt, never a flip. Horizontal yaw is not clamped. */
export const PITCH_MIN = -0.35;
export const PITCH_MAX = 0.4;
export const AUTO_YAW_PER_SEC = 0.18;

export function clampPitch(value: number): number {
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, value));
}

export function buildSantaSofia(spec: typeof SANTA_SOFIA = SANTA_SOFIA): SantaSofiaShell {
  const front = -spec.lotDepth / 2 + spec.frontSetback;
  const centerZ = front + spec.houseDepth / 2;
  const height = spec.floorHeight * spec.stories;
  const back = front + spec.houseDepth;
  const face = 0.05;
  const windowZ = front - face;
  const backZ = back + face;
  const parts: BoxPart[] = [
    { id: "body", role: "body", size: [spec.houseWidth, height, spec.houseDepth], position: [0, height / 2, centerZ] },
    { id: "floor-band", role: "band", size: [spec.houseWidth + 0.08, 0.08, spec.houseDepth + 0.08], position: [0, spec.floorHeight, centerZ] },
    { id: "patio", role: "patio", size: [spec.houseWidth, 0.12, spec.patioDepth], position: [0, 0.06, back + spec.patioDepth / 2] },
    { id: "garage", role: "garage", size: [spec.garageWidth, spec.garageHeight, 0.06], position: [-1.35, spec.garageHeight / 2 + 0.04, windowZ] },
    { id: "front-door", role: "door", size: [0.95, 2.15, 0.08], position: [1.55, 1.08, windowZ] },
    { id: "front-window-a", role: "window", size: [1.15, 1.1, 0.08], position: [-2.05, 4.5, windowZ] },
    { id: "front-window-b", role: "window", size: [1.15, 1.1, 0.08], position: [0, 4.5, windowZ] },
    { id: "front-window-c", role: "window", size: [1.15, 1.1, 0.08], position: [2.05, 4.5, windowZ] },
    { id: "back-door", role: "door", size: [1.4, 2.2, 0.08], position: [0.4, 1.15, backZ] },
    { id: "back-window-low", role: "window", size: [1.05, 1.05, 0.08], position: [-2.05, 1.7, backZ] },
    { id: "back-window-a", role: "window", size: [1.25, 1.15, 0.08], position: [-1.55, 4.5, backZ] },
    { id: "back-window-b", role: "window", size: [1.25, 1.15, 0.08], position: [1.55, 4.5, backZ] }
  ];
  const roof: RoofSpec = {
    width: spec.houseWidth + 0.24,
    depth: spec.houseDepth + 0.28,
    frontHeight: 0.18,
    backHeight: 1.05,
    position: [0, height, centerZ]
  };
  return {
    lotWidth: spec.lotWidth,
    lotDepth: spec.lotDepth,
    stories: spec.stories,
    builtM2: spec.builtM2,
    parts,
    roof
  };
}
