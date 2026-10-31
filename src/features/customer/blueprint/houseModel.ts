/**
 * Stylized Santa Sofía shell, in meters. A two-story rowhouse: wall thickness,
 * slabs, framed openings, a paneled garage door, a canopy, a balcony, parapet
 * and eaves, a back pergola, low walls and an entry step. Not a survey and not
 * a copy of any picture. The house mass is centered on the origin so a vertical
 * spin passes through its middle. There is no vertical tilt.
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
  garageWidth: 2.45,
  garageHeight: 2.18
} as const;

export type BoxRole =
  | "wall" | "slab" | "roof" | "parapet"
  | "garage" | "door" | "window" | "frame" | "mullion" | "sill"
  | "canopy" | "balcony" | "rail"
  | "patio" | "pergola" | "step" | "perimeter";

export type EdgeRank = "primary" | "secondary";

export interface BoxPart {
  id: string;
  role: BoxRole;
  rank: EdgeRank;
  /** The two-story house. Patio, pergola, steps and yard walls are left out of the spin center. */
  house: boolean;
  size: [number, number, number];
  position: [number, number, number];
}

export interface SantaSofiaShell {
  lotWidth: number;
  lotDepth: number;
  stories: number;
  builtM2: number;
  parts: BoxPart[];
  /** Lowest point after the house is centered. The ground plane sits here. */
  groundY: number;
  /** Distance from the origin to the farthest corner, used to frame the camera. */
  radius: number;
}

interface Rect { x0: number; x1: number; y0: number; y1: number }

const HOUSE_ROLES: ReadonlySet<BoxRole> = new Set(["wall", "slab", "roof", "parapet"]);

export function modeledBuiltArea(spec: typeof SANTA_SOFIA = SANTA_SOFIA): number {
  return Math.round(spec.houseWidth * spec.houseDepth * spec.stories * 100) / 100;
}

/** Gentle spin while nobody is dragging. Off when the person asked for less motion. */
export function shouldAutoRotate(reducedMotion: boolean, idle: boolean, dragging: boolean): boolean {
  return !reducedMotion && idle && !dragging;
}

/** One turn takes about half a minute. Dragging uses the same axis. */
export const AUTO_YAW_PER_SEC = 0.22;

export function boundsOf(parts: readonly BoxPart[]): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const axes: Array<0 | 1 | 2> = [0, 1, 2];
  for (const part of parts) {
    for (const axis of axes) {
      const pos = part.position[axis];
      const span = part.size[axis];
      min[axis] = Math.min(min[axis], pos - span / 2);
      max[axis] = Math.max(max[axis], pos + span / 2);
    }
  }
  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  };
}

function cut(rect: Rect, hole: Rect): Rect[] {
  const x0 = Math.max(rect.x0, hole.x0);
  const x1 = Math.min(rect.x1, hole.x1);
  const y0 = Math.max(rect.y0, hole.y0);
  const y1 = Math.min(rect.y1, hole.y1);
  if (x1 - x0 <= 1e-4 || y1 - y0 <= 1e-4) return [rect];
  const out: Rect[] = [];
  if (rect.y0 < y0 - 1e-4) out.push({ x0: rect.x0, x1: rect.x1, y0: rect.y0, y1: y0 });
  if (y1 < rect.y1 - 1e-4) out.push({ x0: rect.x0, x1: rect.x1, y0: y1, y1: rect.y1 });
  if (rect.x0 < x0 - 1e-4) out.push({ x0: rect.x0, x1: x0, y0, y1 });
  if (x1 < rect.x1 - 1e-4) out.push({ x0: x1, x1: rect.x1, y0, y1 });
  return out;
}

function rectsMinus(wall: Rect, holes: readonly Rect[]): Rect[] {
  let free = [wall];
  for (const hole of holes) {
    const next: Rect[] = [];
    for (const rect of free) next.push(...cut(rect, hole));
    free = next.filter((rect) => rect.x1 - rect.x0 > 0.02 && rect.y1 - rect.y0 > 0.02);
  }
  return free;
}

function box(id: string, role: BoxRole, rank: EdgeRank, house: boolean, size: [number, number, number], position: [number, number, number]): BoxPart {
  return { id, role, rank, house, size, position };
}

/** A wall of `thickness` with rectangular holes. `horizontal` is world X for front/back walls. */
function wallPieces(
  id: string,
  holes: readonly Rect[],
  span: Rect,
  thickness: number,
  fixedCenter: number,
  facing: "z" | "x"
): BoxPart[] {
  return rectsMinus(span, holes).map((rect, index) => {
    const size: [number, number, number] = facing === "z"
      ? [rect.x1 - rect.x0, rect.y1 - rect.y0, thickness]
      : [thickness, rect.y1 - rect.y0, rect.x1 - rect.x0];
    const position: [number, number, number] = facing === "z"
      ? [(rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, fixedCenter]
      : [fixedCenter, (rect.y0 + rect.y1) / 2, (rect.x0 + rect.x1) / 2];
    return box(`${id}-${index}`, "wall", "primary", true, size, position);
  });
}

function openingDressing(id: string, hole: Rect, zOuter: number, outward: number): BoxPart[] {
  const depth = 0.07;
  const bar = 0.045;
  const proud = outward * (depth / 2 + 0.02);
  const z = zOuter + proud;
  const width = hole.x1 - hole.x0;
  const height = hole.y1 - hole.y0;
  const cx = (hole.x0 + hole.x1) / 2;
  const cy = (hole.y0 + hole.y1) / 2;
  const parts: BoxPart[] = [
    box(`${id}-head`, "window", "primary", false, [width, bar, depth], [cx, hole.y1 - bar / 2, z]),
    box(`${id}-sill-bar`, "window", "primary", false, [width, bar, depth], [cx, hole.y0 + bar / 2, z]),
    box(`${id}-jamb-l`, "window", "primary", false, [bar, height, depth], [hole.x0 + bar / 2, cy, z]),
    box(`${id}-jamb-r`, "window", "primary", false, [bar, height, depth], [hole.x1 - bar / 2, cy, z]),
    box(`${id}-mull-v`, "mullion", "secondary", false, [0.03, height - bar * 2, 0.04], [cx, cy, z + outward * 0.01]),
    box(`${id}-mull-h`, "mullion", "secondary", false, [width - bar * 2, 0.03, 0.04], [cx, cy, z + outward * 0.01]),
    box(`${id}-sill`, "sill", "primary", false, [width + 0.1, 0.05, 0.12], [cx, hole.y0 - 0.02, zOuter + outward * 0.07])
  ];
  return parts;
}

function paneledDoor(id: string, role: BoxRole, hole: Rect, zOuter: number, outward: number, rows: number, cols: number): BoxPart[] {
  const inset = 0.07;
  const gap = 0.028;
  const depth = 0.04;
  const z = zOuter + outward * (depth / 2 + 0.015);
  const x0 = hole.x0 + inset;
  const x1 = hole.x1 - inset;
  const y0 = hole.y0 + inset;
  const y1 = hole.y1 - inset;
  const paneW = (x1 - x0 - gap * (cols - 1)) / cols;
  const paneH = (y1 - y0 - gap * (rows - 1)) / rows;
  const parts: BoxPart[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = x0 + col * (paneW + gap) + paneW / 2;
      const py = y0 + row * (paneH + gap) + paneH / 2;
      parts.push(box(`${id}-${row}-${col}`, role, "secondary", false, [paneW, paneH, depth], [px, py, z]));
    }
  }
  return parts;
}

export function buildSantaSofia(spec: typeof SANTA_SOFIA = SANTA_SOFIA): SantaSofiaShell {
  const width = spec.houseWidth;
  const depth = spec.houseDepth;
  const story = spec.floorHeight;
  const height = story * spec.stories;
  const wall = 0.18;
  const halfW = width / 2;
  const halfD = depth / 2;
  const innerL = -halfW + wall;
  const innerR = halfW - wall;
  const frontOuter = -halfD;
  const backOuter = halfD;
  const parts: BoxPart[] = [];

  parts.push(box("plinth", "slab", "primary", true, [width + 0.36, 0.2, depth + 0.28], [0, -0.1, 0]));
  parts.push(box("mid-slab", "slab", "primary", true, [width + 0.08, 0.16, depth + 0.08], [0, story, 0]));
  parts.push(box("roof-deck", "roof", "primary", true, [width + 0.64, 0.16, depth + 0.64], [0, height + 0.08, 0]));

  const parapetH = 0.4;
  const parapetT = 0.1;
  const parapetY = height + 0.16 + parapetH / 2;
  parts.push(box("parapet-front", "parapet", "primary", true, [width, parapetH, parapetT], [0, parapetY, frontOuter + parapetT / 2]));
  parts.push(box("parapet-back", "parapet", "primary", true, [width, parapetH, parapetT], [0, parapetY, backOuter - parapetT / 2]));
  parts.push(box("parapet-left", "parapet", "primary", true, [parapetT, parapetH, depth], [-halfW + parapetT / 2, parapetY, 0]));
  parts.push(box("parapet-right", "parapet", "primary", true, [parapetT, parapetH, depth], [halfW - parapetT / 2, parapetY, 0]));

  const wallSpan: Rect = { x0: innerL, x1: innerR, y0: 0, y1: height };
  const garage: Rect = { x0: innerL + 0.2, x1: innerL + 0.2 + spec.garageWidth, y0: 0, y1: spec.garageHeight };
  const door: Rect = { x0: 0.85, x1: 1.85, y0: 0, y1: 2.2 };
  const upper = (x: number, w = 0.96): Rect => ({ x0: x - w / 2, x1: x + w / 2, y0: 4.05, y1: 5.25 });
  const frontWindows = [upper(-1.7), upper(0.05), upper(1.75)];
  const frontHoles = [garage, door, ...frontWindows];

  parts.push(...wallPieces("front", frontHoles, wallSpan, wall, frontOuter + wall / 2, "z"));
  parts.push(...paneledDoor("garage-leaf", "garage", garage, frontOuter, -1, 4, 2));
  parts.push(...paneledDoor("front-door-leaf", "door", door, frontOuter, -1, 2, 1));
  frontWindows.forEach((hole, index) => parts.push(...openingDressing(`front-win-${index}`, hole, frontOuter, -1)));

  const canopyZ = frontOuter - 0.36;
  parts.push(box("canopy", "canopy", "primary", false, [1.45, 0.08, 0.72], [(door.x0 + door.x1) / 2, 2.38, canopyZ]));
  parts.push(box("canopy-bracket-l", "canopy", "secondary", false, [0.06, 0.16, 0.28], [door.x0 + 0.08, 2.26, frontOuter - 0.16]));
  parts.push(box("canopy-bracket-r", "canopy", "secondary", false, [0.06, 0.16, 0.28], [door.x1 - 0.08, 2.26, frontOuter - 0.16]));

  const stepW = door.x1 - door.x0 + 0.3;
  const stepX = (door.x0 + door.x1) / 2;
  parts.push(box("step-upper", "step", "primary", false, [stepW, 0.14, 0.36], [stepX, -0.07, frontOuter - 0.22]));
  parts.push(box("step-lower", "step", "primary", false, [stepW + 0.16, 0.14, 0.34], [stepX, -0.21, frontOuter - 0.54]));

  const balcony: Rect = { x0: -1.15, x1: 1.15, y0: 3.7, y1: 3.82 };
  parts.push(box("balcony", "balcony", "primary", false, [balcony.x1 - balcony.x0, 0.1, 0.78], [0, balcony.y0 + 0.05, frontOuter - 0.32]));
  parts.push(box("balcony-rail", "rail", "secondary", false, [2.3, 0.04, 0.04], [0, 4.22, frontOuter - 0.66]));
  for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) {
    parts.push(box(`balcony-post-${x}`, "rail", "secondary", false, [0.04, 0.48, 0.04], [x, 3.98, frontOuter - 0.66]));
  }

  parts.push(box("side-left", "wall", "primary", true, [wall, height, depth], [-halfW + wall / 2, height / 2, 0]));
  parts.push(box("side-right", "wall", "primary", true, [wall, height, depth], [halfW - wall / 2, height / 2, 0]));
  parts.push(box("downspout", "frame", "secondary", false, [0.06, height + 0.3, 0.06], [halfW + 0.02, height / 2, halfD - 0.4]));

  const backDoor: Rect = { x0: -0.15, x1: 1.25, y0: 0, y1: 2.2 };
  const backLow: Rect = { x0: -2.35, x1: -1.15, y0: 1.05, y1: 2.15 };
  const backUpper = [upper(-1.7, 1.15), upper(1.55, 1.15)];
  parts.push(...wallPieces("back", [backDoor, backLow, ...backUpper], wallSpan, wall, backOuter - wall / 2, "z"));
  parts.push(...openingDressing("back-door", backDoor, backOuter, 1));
  parts.push(...openingDressing("back-low", backLow, backOuter, 1));
  backUpper.forEach((hole, index) => parts.push(...openingDressing(`back-win-${index}`, hole, backOuter, 1)));

  const patioDepth = Math.min(spec.patioDepth, 4);
  parts.push(box("patio", "patio", "primary", false, [width, 0.12, patioDepth], [0, 0.02, backOuter + patioDepth / 2]));
  const postH = 2.45;
  const beam = 0.1;
  const pergolaFront = backOuter + 0.35;
  const pergolaBack = backOuter + patioDepth - 0.25;
  for (const [name, x, z] of [
    ["fl", -halfW + 0.3, pergolaFront],
    ["fr", halfW - 0.3, pergolaFront],
    ["bl", -halfW + 0.3, pergolaBack],
    ["br", halfW - 0.3, pergolaBack]
  ] as const) {
    parts.push(box(`pergola-post-${name}`, "pergola", "primary", false, [0.12, postH, 0.12], [x, postH / 2, z]));
  }
  parts.push(box("pergola-beam-front", "pergola", "primary", false, [width - 0.2, beam, beam], [0, postH, pergolaFront]));
  parts.push(box("pergola-beam-back", "pergola", "primary", false, [width - 0.2, beam, beam], [0, postH, pergolaBack]));
  for (let i = 0; i < 6; i += 1) {
    const z = pergolaFront + ((pergolaBack - pergolaFront) * i) / 5;
    parts.push(box(`pergola-joist-${i}`, "pergola", "secondary", false, [width - 0.15, 0.06, 0.08], [0, postH + 0.06, z]));
  }

  parts.push(box("yard-left", "perimeter", "primary", false, [0.12, 0.42, 2.4], [-halfW - 0.15, 0.21, frontOuter - 0.7]));
  parts.push(box("yard-right", "perimeter", "primary", false, [0.12, 0.42, 2.4], [halfW + 0.15, 0.21, frontOuter - 0.7]));

  const mass = parts.filter((part) => part.house && HOUSE_ROLES.has(part.role));
  const center = boundsOf(mass).center;
  const centered = parts.map((part) => ({
    ...part,
    position: [
      part.position[0] - center[0],
      part.position[1] - center[1],
      part.position[2] - center[2]
    ] as [number, number, number]
  }));
  const all = boundsOf(centered);
  let radius = 0;
  for (const part of centered) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = part.position[0] + sx * part.size[0] / 2;
          const y = part.position[1] + sy * part.size[1] / 2;
          const z = part.position[2] + sz * part.size[2] / 2;
          radius = Math.max(radius, Math.hypot(x, y, z));
        }
      }
    }
  }
  return {
    lotWidth: spec.lotWidth,
    lotDepth: spec.lotDepth,
    stories: spec.stories,
    builtM2: spec.builtM2,
    parts: centered,
    groundY: all.min[1],
    radius
  };
}
