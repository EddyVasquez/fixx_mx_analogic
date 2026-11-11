import type { FactId } from "./houseFocus";
import type { RoomId } from "./houseRooms";

/** What a fact card does to the house. Targets are room ids, group names, or mesh names. */
export type EffectKind = "explode" | "measure" | "volumes" | "pins" | "garage";

export interface FactEffect {
  kind: EffectKind;
  targets: readonly string[];
  numbered: boolean;
}

export const FACT_EFFECTS: Record<FactId, FactEffect> = {
  stories: { kind: "explode", targets: ["Ground", "Upper", "Roof"], numbered: false },
  built: { kind: "measure", targets: ["Site_Lot", "Ground_Slab"], numbered: false },
  bedrooms: { kind: "volumes", targets: ["Room_MainBed", "Room_Bed2", "Room_Bed3"], numbered: true },
  bathrooms: { kind: "volumes", targets: ["Room_Bath_Ground", "Room_Bath_Upper"], numbered: true },
  minisplits: { kind: "pins", targets: ["Minisplit_Condenser", "Minisplit_Indoor_MainBed"], numbered: false },
  garage: { kind: "garage", targets: ["Room_Garage"], numbered: false }
};

/** Floors hidden above a zoomed space. `ground` hides the upper floor and the roof. */
export type Cutaway = "ground" | "upper" | null;

const ROOM_TRADE: Record<RoomId, string> = {
  Room_Bath_Ground: "plumbing",
  Room_Bath_Upper: "plumbing",
  Room_Kitchen: "plumbing",
  Room_Laundry: "plumbing",
  Room_Garage: "electrical",
  Room_MainBed: "electrical",
  Room_Bed2: "electrical",
  Room_Bed3: "electrical",
  Room_Hall: "electrical"
};

const ROOM_KEY: Record<RoomId, string> = {
  Room_Garage: "myhome.room.garage",
  Room_Kitchen: "myhome.room.kitchen",
  Room_Laundry: "myhome.room.laundry",
  Room_Bath_Ground: "myhome.room.bathGround",
  Room_Bath_Upper: "myhome.room.bathUpper",
  Room_MainBed: "myhome.room.mainBed",
  Room_Bed2: "myhome.room.bed2",
  Room_Bed3: "myhome.room.bed3",
  Room_Hall: "myhome.room.hall"
};

/** Trade preselected when a zoomed space asks for work. Null when the space is the whole shell. */
export function tradeForSpace(id: string): string | null {
  if (id.startsWith("pin:")) return "hvac";
  if (id in ROOM_TRADE) return ROOM_TRADE[id as RoomId];
  return null;
}

/** i18n key for the blueprint callout label. */
export function labelKey(id: string): string {
  if (id.startsWith("floor:")) {
    const name = id.slice("floor:".length);
    if (name === "Ground") return "myhome.room.ground";
    if (name === "Upper") return "myhome.room.upper";
    return "myhome.room.roof";
  }
  if (id === "built:footprint") return "myhome.room.footprint";
  if (id === "pin:Minisplit_Condenser") return "myhome.room.condenser";
  if (id.startsWith("pin:")) return "myhome.room.indoor";
  if (id in ROOM_KEY) return ROOM_KEY[id as RoomId];
  return "myhome.room.hall";
}

export function cutawayFor(id: string): Cutaway {
  if (id === "floor:Ground" || id === "Room_Garage" || id === "Room_Kitchen" || id === "Room_Laundry" || id === "Room_Bath_Ground") return "ground";
  if (id === "floor:Upper" || id === "Room_MainBed" || id === "Room_Bed2" || id === "Room_Bed3" || id === "Room_Bath_Upper" || id === "Room_Hall" || id === "pin:Minisplit_Indoor_MainBed") return "upper";
  return null;
}

/** Spaces the pointer can choose while a fact is showing. */
export function pickableIds(fact: FactId): string[] {
  const effect = FACT_EFFECTS[fact];
  if (effect.kind === "explode") return effect.targets.map((name) => `floor:${name}`);
  if (effect.kind === "measure") return ["built:footprint"];
  if (effect.kind === "pins") return effect.targets.map((name) => `pin:${name}`);
  return [...effect.targets];
}
