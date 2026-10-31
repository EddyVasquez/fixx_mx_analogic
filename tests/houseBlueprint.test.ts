import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  AUTO_YAW_PER_SEC,
  CAMERA_FOV_DEG,
  FIT_PAD,
  HOUSE_FALLBACK_URL,
  HOUSE_MODEL_FILE,
  HOUSE_MODEL_URL,
  boxCorners,
  placeCamera,
  projectedNdc,
  shouldAutoRotate,
  yawPoint,
  type Vec3
} from "../src/features/customer/blueprint/houseModel";

const ASPECTS = [1.05, 1.25, 1.6, 2.2];
const YAWS = [0, Math.PI / 6, Math.PI / 2, Math.PI, -Math.PI / 3];

function expectBoxOnScreen(min: Vec3, max: Vec3): void {
  for (const aspect of ASPECTS) {
    const placement = placeCamera(min, max, aspect);
    let limiting = 0;
    for (const yaw of YAWS) {
      for (const corner of boxCorners(min, max)) {
        const ndc = projectedNdc(yawPoint(corner, yaw), placement, aspect);
        expect(ndc.depth).toBeGreaterThan(placement.near);
        expect(ndc.depth).toBeLessThan(placement.far);
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
        limiting = Math.max(limiting, Math.abs(ndc.x), Math.abs(ndc.y));
      }
    }
    expect(limiting).toBeGreaterThan(1 / FIT_PAD - 0.08);
  }
}

describe("Santa Sofía house model", () => {
  it("spins only while idle, and only around the vertical axis", () => {
    expect(shouldAutoRotate(false, true, false)).toBe(true);
    expect(shouldAutoRotate(true, true, false)).toBe(false);
    expect(shouldAutoRotate(false, false, false)).toBe(false);
    expect(shouldAutoRotate(false, true, true)).toBe(false);
    expect(AUTO_YAW_PER_SEC).toBeGreaterThan(0);
    expect(AUTO_YAW_PER_SEC).toBeLessThan(0.5);
    const live = readFileSync(join(process.cwd(), "src/features/customer/blueprint/HouseBlueprint.tsx"), "utf8");
    expect(live).toMatch(/rotation\.y/);
    expect(live).not.toMatch(/rotation\.x/);
    expect(live).toMatch(/EdgesGeometry/);
    expect(live).toMatch(/GLTFLoader/);
    expect(live).not.toMatch(/clampPitch|buildSantaSofia/);
  });

  it("points at one swappable file under the Vite base", () => {
    expect(HOUSE_MODEL_FILE).toBe("santa-sofia-house.glb");
    expect(HOUSE_MODEL_URL).toBe(`/fixx_mx_analogic/models/${HOUSE_MODEL_FILE}`);
    expect(HOUSE_FALLBACK_URL).toBe("/fixx_mx_analogic/models/santa-sofia-house.png");
    const png = readFileSync(join(process.cwd(), "public/models/santa-sofia-house.png"));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.byteLength).toBeGreaterThan(10_000);
    expect(CAMERA_FOV_DEG).toBeGreaterThan(20);
    expect(CAMERA_FOV_DEG).toBeLessThan(60);
  });

  it("keeps a level camera on the real GLB at phone and tablet aspects", async () => {
    const buf = readFileSync(join(process.cwd(), "public/models", HOUSE_MODEL_FILE));
    expect(buf.byteLength).toBeGreaterThan(50_000);
    expect(buf.byteLength).toBeLessThan(3_000_000);
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
    });
    const names = new Set<string>();
    let tris = 0;
    gltf.scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const geometry = obj.geometry;
      tris += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute("position")?.count ?? 0) / 3;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach((mat) => names.add(mat.name));
    });
    expect(tris).toBeGreaterThan(1000);
    expect(tris).toBeLessThan(50_000);
    expect(names.has("Wall_Grey")).toBe(true);
    expect(names.has("Trim_Charcoal")).toBe(true);
    expect(names.has("Glass")).toBe(true);
    expect(names.has("Accent_Lime")).toBe(false);

    gltf.scene.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(gltf.scene);
    expect(box.min.x).toBeLessThan(0);
    expect(box.max.x).toBeGreaterThan(0);
    expect(box.min.z).toBeLessThan(0);
    expect(box.max.z).toBeGreaterThan(0);
    expect(box.min.y).toBeLessThanOrEqual(0.05);
    expect(box.max.y).toBeGreaterThan(5);
    expect(box.max.x - box.min.x).toBeGreaterThan(6);
    expect(box.max.x - box.min.x).toBeLessThan(8);
    expectBoxOnScreen(
      { x: box.min.x, y: box.min.y, z: box.min.z },
      { x: box.max.x, y: box.max.y, z: box.max.z }
    );
  });
});
