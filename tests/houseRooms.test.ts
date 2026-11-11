import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Group, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Box3 } from "three";
import { FACT_EFFECTS, cutawayFor, pickableIds, tradeForSpace } from "../src/features/customer/blueprint/houseEffects";
import type { FactId } from "../src/features/customer/blueprint/houseFocus";
import { deriveRooms, volumeHoldsOpening, ROOM_RULES, type Aabb, type RoomId } from "../src/features/customer/blueprint/houseRooms";
import { keepSingleHouse } from "../src/features/customer/blueprint/houseScene";

/** Wall and opening bounds measured from santa-sofia-house.glb (meters, Y-up, front +Z). */
const BOXES: Record<string, Aabb> = {
  Ground_Slab: box(-3.35, -0.35, -3.97, 1.23, -0.25, 1.65),
  Upper_Slab: box(-3.38, 1.55, -4.01, 1.26, 1.65, 1.74),
  Roof_Slab: box(-3.38, 3.44, -4.01, 1.26, 3.55, 1.74),
  Ground_Wall_Back: box(-3.35, -0.25, -3.97, 1.23, 1.55, -3.87),
  Ground_Wall_Front: box(-3.35, -0.25, 1.55, 1.23, 1.55, 1.65),
  Ground_Wall_Party_L: box(-3.35, -0.25, -3.87, -3.24, 1.55, 1.55),
  Ground_Wall_Party_R: box(1.12, -0.25, -3.87, 1.23, 1.55, 1.55),
  Ground_Wall_Interior_Bath: box(-0.43, -0.25, -3.87, -0.36, 1.55, -2.00),
  Ground_Wall_Interior_Garage: box(-3.24, -0.25, -0.39, -0.92, 1.55, -0.32),
  Ground_Wall_Interior_Kitchen: box(-3.24, -0.25, -2.07, -1.52, 1.55, -2.00),
  Upper_Wall_Back: box(-3.35, 1.65, -3.97, 1.23, 3.44, -3.87),
  Upper_Wall_Front: box(-3.35, 1.65, 1.55, 1.23, 3.44, 1.65),
  Upper_Wall_Party_L: box(-3.35, 1.65, -3.87, -3.24, 3.44, 1.55),
  Upper_Wall_Party_R: box(1.12, 1.65, -3.87, 1.23, 3.44, 1.55),
  Upper_Wall_Interior_Bath: box(-3.24, 1.65, -2.14, 1.12, 3.44, -2.07),
  Upper_Wall_Interior_Bed23: box(-1.06, 1.65, -3.87, -0.99, 3.44, -2.07),
  Upper_Wall_Interior_Hall: box(-3.24, 1.65, -0.81, 1.12, 3.44, -0.74),
  Upper_MainBed_BalconyDoor_Glass: box(-2.95, 1.65, 1.67, -0.68, 3.16, 1.68),
  Upper_Bed2_Window_Glass: box(-0.10, 2.33, 1.67, 0.87, 3.16, 1.68)
};

const OPENINGS: Record<string, { room: RoomId; box: Aabb }> = {
  Ground_Window_Kitchen_Glass: { room: "Room_Kitchen", box: box(-3.02, 0.53, -4.00, -2.23, 1.15, -3.99) },
  Ground_Window_Laundry_Glass: { room: "Room_Laundry", box: box(0.25, 0.88, -4.00, 0.87, 1.22, -3.99) },
  GarageDoor_Panel_1: { room: "Room_Garage", box: box(-3.08, -0.23, 1.59, -0.98, 0.00, 1.62) },
  Upper_Bed3_Window_Glass: { room: "Room_Bed3", box: box(-2.85, 2.33, -4.00, -1.52, 3.16, -3.99) },
  Upper_Bed2b_Window_Glass: { room: "Room_Bed2", box: box(-0.60, 2.33, -4.00, 0.73, 3.16, -3.99) },
  Upper_Bed2_Window_Glass: { room: "Room_Bed2", box: box(-0.10, 2.33, 1.67, 0.87, 3.16, 1.68) },
  Upper_MainBed_BalconyDoor_Glass: { room: "Room_MainBed", box: box(-2.95, 1.65, 1.67, -0.68, 3.16, 1.68) }
};

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Aabb {
  return { min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } };
}

describe("room volumes", () => {
  const rooms = deriveRooms(BOXES);

  it("builds every named room from the wall faces", () => {
    expect(rooms.map((room) => room.id)).toEqual([
      "Room_Kitchen", "Room_Laundry", "Room_Bath_Ground", "Room_Garage",
      "Room_Bed3", "Room_Bed2", "Room_Bed2", "Room_MainBed", "Room_Bath_Upper", "Room_Hall"
    ]);
    for (const room of rooms) {
      expect(room.max.x).toBeGreaterThan(room.min.x);
      expect(room.max.y).toBeGreaterThan(room.min.y);
      expect(room.max.z).toBeGreaterThan(room.min.z);
    }
  });

  it("puts each named opening in the room on that side of the wall", () => {
    for (const [name, opening] of Object.entries(OPENINGS)) {
      const holders = rooms.filter((room) => volumeHoldsOpening(room, opening.box)).map((room) => room.id);
      expect(holders, name).toEqual([opening.room]);
    }
  });

  it("marks the placements the openings do not prove", () => {
    const guessed = ROOM_RULES.filter((rule) => rule.guessed).map((rule) => `${rule.id}:${rule.part}`);
    expect(guessed).toEqual([
      "Room_Bath_Ground:main",
      "Room_Bed2:front",
      "Room_MainBed:main",
      "Room_Bath_Upper:main",
      "Room_Hall:main"
    ]);
  });

  it("skips a room when its wall is missing", () => {
    const { Ground_Wall_Interior_Garage: _garage, ...rest } = BOXES;
    const ids = deriveRooms(rest).map((room) => room.id);
    expect(ids).not.toContain("Room_Garage");
    expect(ids).toContain("Room_Kitchen");
  });
});

describe("fact card effects", () => {
  it("maps each card to one house effect", () => {
    const facts: FactId[] = ["stories", "built", "bedrooms", "bathrooms", "minisplits", "garage"];
    expect(facts.map((fact) => FACT_EFFECTS[fact].kind)).toEqual(["explode", "measure", "volumes", "volumes", "pins", "garage"]);
    expect(FACT_EFFECTS.stories.targets).toEqual(["Ground", "Upper", "Roof"]);
    expect(FACT_EFFECTS.built.targets).toEqual(["Site_Lot", "Ground_Slab"]);
    expect(FACT_EFFECTS.bedrooms.targets).toEqual(["Room_MainBed", "Room_Bed2", "Room_Bed3"]);
    expect(FACT_EFFECTS.bedrooms.numbered).toBe(true);
    expect(FACT_EFFECTS.bathrooms.targets).toEqual(["Room_Bath_Ground", "Room_Bath_Upper"]);
    expect(FACT_EFFECTS.bathrooms.numbered).toBe(true);
    expect(FACT_EFFECTS.minisplits.targets).toEqual(["Minisplit_Condenser", "Minisplit_Indoor_MainBed"]);
    expect(FACT_EFFECTS.garage.targets).toEqual(["Room_Garage"]);
    expect(pickableIds("stories")).toEqual(["floor:Ground", "floor:Upper", "floor:Roof"]);
    expect(pickableIds("minisplits")).toEqual(["pin:Minisplit_Condenser", "pin:Minisplit_Indoor_MainBed"]);
  });

  it("picks the trade and the floors to cut away from the space", () => {
    expect(tradeForSpace("Room_Bath_Ground")).toBe("plumbing");
    expect(tradeForSpace("Room_Bath_Upper")).toBe("plumbing");
    expect(tradeForSpace("Room_Kitchen")).toBe("plumbing");
    expect(tradeForSpace("Room_Laundry")).toBe("plumbing");
    expect(tradeForSpace("Room_Garage")).toBe("electrical");
    expect(tradeForSpace("pin:Minisplit_Condenser")).toBe("hvac");
    expect(tradeForSpace("pin:Minisplit_Indoor_MainBed")).toBe("hvac");
    expect(tradeForSpace("floor:Ground")).toBeNull();
    expect(tradeForSpace("built:footprint")).toBeNull();
    expect(cutawayFor("Room_Garage")).toBe("ground");
    expect(cutawayFor("Room_MainBed")).toBe("upper");
    expect(cutawayFor("pin:Minisplit_Indoor_MainBed")).toBe("upper");
    expect(cutawayFor("pin:Minisplit_Condenser")).toBeNull();
    expect(cutawayFor("floor:Roof")).toBeNull();
  });
});

describe("house model roots", () => {
  it("drops the second spline root and restores authored names", () => {
    const root = new Group();
    const duplicate = new Group();
    duplicate.name = "santa-sofia-house_2";
    const duplicateHouse = new Group();
    duplicateHouse.name = "SantaSofia_House";
    duplicate.add(duplicateHouse);
    const kept = new Group();
    kept.name = "santa-sofia-house";
    const house = new Group();
    house.name = "SantaSofia_House_1";
    const wall = new Group();
    wall.name = "Ground_Wall_Party_L_1";
    house.add(wall);
    kept.add(house);
    root.add(duplicate, kept);
    keepSingleHouse(root);
    expect(root.getObjectByName("santa-sofia-house_2")).toBeUndefined();
    expect(root.getObjectByName("SantaSofia_House")?.parent?.name).toBe("santa-sofia-house");
    expect(root.getObjectByName("Ground_Wall_Party_L")).toBe(wall);
    expect(root.getObjectByName("SantaSofia_House_1")).toBeUndefined();
  });

  it("keeps a single copy of the shipped model and still finds the named walls", async () => {
    const buf = readFileSync("public/models/santa-sofia-house.glb");
    const jsonLength = buf.readUInt32LE(12);
    const json = buf.subarray(20, 20 + jsonLength).toString("utf8");
    expect(json).toContain("santa-sofia-house 2");
    const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => {
      new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
    });
    keepSingleHouse(gltf.scene);
    expect(gltf.scene.getObjectByName("santa-sofia-house_2")).toBeUndefined();
    expect(gltf.scene.getObjectByName("santa-sofia-house")).toBeTruthy();
    const houses: string[] = [];
    gltf.scene.traverse((obj) => {
      if (obj.name === "SantaSofia_House") houses.push(obj.name);
    });
    expect(houses).toEqual(["SantaSofia_House"]);
    for (const name of ["Ground", "Upper", "Roof", "Site_Lot", "Minisplit_Condenser", "Minisplit_Indoor_MainBed", "Ground_Wall_Interior_Kitchen"]) {
      expect(gltf.scene.getObjectByName(name), name).toBeTruthy();
    }
    const boxes: Record<string, Aabb> = {};
    gltf.scene.updateWorldMatrix(true, true);
    gltf.scene.traverse((obj) => {
      if (!obj.name) return;
      const bounds = new Box3().setFromObject(obj);
      if (bounds.isEmpty()) return;
      boxes[obj.name] = {
        min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
        max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }
      };
    });
    const derived = deriveRooms(boxes);
    expect(new Set(derived.map((room) => room.id)).size).toBe(9);
    for (const [name, opening] of Object.entries(OPENINGS)) {
      const holders = derived.filter((room) => volumeHoldsOpening(room, boxes[name]!)).map((room) => room.id);
      expect(holders, name).toEqual([opening.room]);
    }
  });
});
