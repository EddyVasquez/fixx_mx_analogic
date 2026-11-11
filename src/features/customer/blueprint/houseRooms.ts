import type { Vec3 } from "./houseModel";

/**
 * Room volumes for the Santa Sofía Spline export.
 *
 * The file has no room meshes. Each rule names the wall faces that bound a
 * volume, so a later correction is a face change here and not a scene edit.
 * `guessed` marks a placement the window and door names do not prove.
 *
 * Model axes: Y up, front is +Z, party wall L is -X.
 */
export type RoomId =
  | "Room_Garage"
  | "Room_Kitchen"
  | "Room_Laundry"
  | "Room_Bath_Ground"
  | "Room_Bath_Upper"
  | "Room_MainBed"
  | "Room_Bed2"
  | "Room_Bed3"
  | "Room_Hall";

export type Level = "ground" | "upper";

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

type Axis = "x" | "z";
type Face = "min" | "max";

interface WallFace {
  wall: string;
  face: Face;
  axis: Axis;
}

/** A wall face, or the midpoint between two faces (the gap between two openings). */
type Edge = WallFace | { mid: [WallFace, WallFace] };

export interface RoomRule {
  id: RoomId;
  part: string;
  level: Level;
  /** Badge drawn on bedroom and bathroom volumes. */
  tag: number | null;
  guessed: boolean;
  /** Why this side of the wall was chosen. */
  note: string;
  x0: Edge;
  x1: Edge;
  z0: Edge;
  z1: Edge;
}

const face = (wall: string, which: Face, axis: Axis): WallFace => ({ wall, face: which, axis });

export const ROOM_RULES: readonly RoomRule[] = [
  {
    id: "Room_Kitchen",
    part: "main",
    level: "ground",
    tag: null,
    guessed: false,
    note: "Kitchen window is on the back wall, left of the bath wall. The kitchen partition stops before that wall; the patio door spans the extra width.",
    x0: face("Ground_Wall_Party_L", "max", "x"),
    x1: face("Ground_Wall_Interior_Bath", "min", "x"),
    z0: face("Ground_Wall_Back", "max", "z"),
    z1: face("Ground_Wall_Interior_Kitchen", "min", "z")
  },
  {
    id: "Room_Laundry",
    part: "main",
    level: "ground",
    tag: null,
    guessed: false,
    note: "Laundry window is on the back wall, right of the bath wall. The room stops where that wall ends.",
    x0: face("Ground_Wall_Interior_Bath", "max", "x"),
    x1: face("Ground_Wall_Party_R", "min", "x"),
    z0: face("Ground_Wall_Back", "max", "z"),
    z1: face("Ground_Wall_Interior_Bath", "max", "z")
  },
  {
    id: "Room_Bath_Ground",
    part: "main",
    level: "ground",
    tag: 1,
    guessed: true,
    note: "No ground-floor bath window. The closed cell between the kitchen partition and the garage wall is the likely bath.",
    x0: face("Ground_Wall_Party_L", "max", "x"),
    x1: face("Ground_Wall_Interior_Garage", "max", "x"),
    z0: face("Ground_Wall_Interior_Kitchen", "max", "z"),
    z1: face("Ground_Wall_Interior_Garage", "min", "z")
  },
  {
    id: "Room_Garage",
    part: "main",
    level: "ground",
    tag: null,
    guessed: false,
    note: "Garage door is on the front wall, in front of the garage partition. The right edge is where that partition ends.",
    x0: face("Ground_Wall_Party_L", "max", "x"),
    x1: face("Ground_Wall_Interior_Garage", "max", "x"),
    z0: face("Ground_Wall_Interior_Garage", "max", "z"),
    z1: face("Ground_Wall_Front", "min", "z")
  },
  {
    id: "Room_Bed3",
    part: "main",
    level: "upper",
    tag: 3,
    guessed: false,
    note: "Bed3 window is on the back wall, left of the bed 2/3 partition and behind the bath wall.",
    x0: face("Upper_Wall_Party_L", "max", "x"),
    x1: face("Upper_Wall_Interior_Bed23", "min", "x"),
    z0: face("Upper_Wall_Back", "max", "z"),
    z1: face("Upper_Wall_Interior_Bath", "min", "z")
  },
  {
    id: "Room_Bed2",
    part: "back",
    level: "upper",
    tag: 2,
    guessed: false,
    note: "Bed2b window is on the back wall, right of the bed 2/3 partition.",
    x0: face("Upper_Wall_Interior_Bed23", "max", "x"),
    x1: face("Upper_Wall_Party_R", "min", "x"),
    z0: face("Upper_Wall_Back", "max", "z"),
    z1: face("Upper_Wall_Interior_Bath", "min", "z")
  },
  {
    id: "Room_Bed2",
    part: "front",
    level: "upper",
    tag: 2,
    guessed: true,
    note: "The front Bed2 window sits right of the balcony door. The stair landing is between this cell and the back cell, so bedroom 2 is two volumes.",
    x0: {
      mid: [
        face("Upper_MainBed_BalconyDoor_Glass", "max", "x"),
        face("Upper_Bed2_Window_Glass", "min", "x")
      ]
    },
    x1: face("Upper_Wall_Party_R", "min", "x"),
    z0: face("Upper_Wall_Interior_Hall", "max", "z"),
    z1: face("Upper_Wall_Front", "min", "z")
  },
  {
    id: "Room_MainBed",
    part: "main",
    level: "upper",
    tag: 1,
    guessed: true,
    note: "Balcony door is on the front-left. The right edge is the gap between that door and the front Bed2 window; no wall mesh marks it.",
    x0: face("Upper_Wall_Party_L", "max", "x"),
    x1: {
      mid: [
        face("Upper_MainBed_BalconyDoor_Glass", "max", "x"),
        face("Upper_Bed2_Window_Glass", "min", "x")
      ]
    },
    z0: face("Upper_Wall_Interior_Hall", "max", "z"),
    z1: face("Upper_Wall_Front", "min", "z")
  },
  {
    id: "Room_Bath_Upper",
    part: "main",
    level: "upper",
    tag: 1,
    guessed: true,
    note: "No upper bath window. Placed on the front side of the bath wall, left of the bed 2/3 line, back of the hall wall.",
    x0: face("Upper_Wall_Party_L", "max", "x"),
    x1: face("Upper_Wall_Interior_Bed23", "min", "x"),
    z0: face("Upper_Wall_Interior_Bath", "max", "z"),
    z1: face("Upper_Wall_Interior_Hall", "min", "z")
  },
  {
    id: "Room_Hall",
    part: "main",
    level: "upper",
    tag: null,
    guessed: true,
    note: "The hall wall's back side, right of the bed 2/3 line. The stair stringer lands in this cell.",
    x0: face("Upper_Wall_Interior_Bed23", "max", "x"),
    x1: face("Upper_Wall_Party_R", "min", "x"),
    z0: face("Upper_Wall_Interior_Bath", "max", "z"),
    z1: face("Upper_Wall_Interior_Hall", "min", "z")
  }
];

export interface RoomVolume {
  id: RoomId;
  part: string;
  level: Level;
  tag: number | null;
  guessed: boolean;
  min: Vec3;
  max: Vec3;
}

const INSET = 0.03;

function edgeValue(boxes: Readonly<Record<string, Aabb>>, edge: Edge): number | null {
  if ("mid" in edge) {
    const left = edgeValue(boxes, edge.mid[0]);
    const right = edgeValue(boxes, edge.mid[1]);
    if (left == null || right == null) return null;
    return (left + right) / 2;
  }
  const box = boxes[edge.wall];
  if (!box) return null;
  return box[edge.face][edge.axis];
}

function slabY(boxes: Readonly<Record<string, Aabb>>, level: Level): { y0: number; y1: number } | null {
  if (level === "ground") {
    const floor = boxes.Ground_Slab;
    const ceiling = boxes.Upper_Slab;
    if (!floor || !ceiling) return null;
    return { y0: floor.max.y, y1: ceiling.min.y };
  }
  const floor = boxes.Upper_Slab;
  const ceiling = boxes.Roof_Slab;
  if (!floor || !ceiling) return null;
  return { y0: floor.max.y, y1: ceiling.min.y };
}

/** Build one box per rule. A rule whose wall is missing is skipped. */
export function deriveRooms(boxes: Readonly<Record<string, Aabb>>): RoomVolume[] {
  const volumes: RoomVolume[] = [];
  for (const rule of ROOM_RULES) {
    const x0 = edgeValue(boxes, rule.x0);
    const x1 = edgeValue(boxes, rule.x1);
    const z0 = edgeValue(boxes, rule.z0);
    const z1 = edgeValue(boxes, rule.z1);
    const y = slabY(boxes, rule.level);
    if (x0 == null || x1 == null || z0 == null || z1 == null || !y) continue;
    if (x1 - x0 < 0.2 || z1 - z0 < 0.2 || y.y1 - y.y0 < 0.2) continue;
    volumes.push({
      id: rule.id,
      part: rule.part,
      level: rule.level,
      tag: rule.tag,
      guessed: rule.guessed,
      min: { x: x0 + INSET, y: y.y0 + INSET, z: z0 + INSET },
      max: { x: x1 - INSET, y: y.y1 - INSET, z: z1 - INSET }
    });
  }
  return volumes;
}

/**
 * True when an opening belongs to this volume.
 * Glass sits just outside the wall face, so X and Z allow a small slack.
 * Y has to fall inside the floor or a ground window also matches the room above it.
 */
export function volumeHoldsOpening(volume: RoomVolume, opening: Aabb, slack = 0.35): boolean {
  const cx = (opening.min.x + opening.max.x) / 2;
  const cy = (opening.min.y + opening.max.y) / 2;
  const cz = (opening.min.z + opening.max.z) / 2;
  const xOk = cx >= volume.min.x - slack && cx <= volume.max.x + slack;
  const yOk = cy >= volume.min.y - slack && cy <= volume.max.y + slack;
  const zOk = cz >= volume.min.z - slack && cz <= volume.max.z + slack;
  return xOk && yOk && zOk;
}
