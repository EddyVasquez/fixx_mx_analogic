/**
 * Santa Sofía house shown in the My Home hero.
 *
 * Swap a newer Spline export by replacing the file in public/models and, if the
 * name changed, this one constant. Exports are named santa-sofia-house_vNN.glb.
 * The matching fallback image uses the same stem with a .png extension.
 * Units are meters, Y-up, origin at the footprint center on the ground, front toward +Z.
 */
export const HOUSE_MODEL_FILE = "santa-sofia-house.glb";

const base = import.meta.env.BASE_URL || "/";
export const HOUSE_MODEL_URL = `${base}models/${HOUSE_MODEL_FILE}`;
export const HOUSE_FALLBACK_URL = `${base}models/${HOUSE_MODEL_FILE.replace(/\.glb$/i, ".png")}`;

/** Gentle spin while nobody is dragging. Off when the person asked for less motion. */
export function shouldAutoRotate(reducedMotion: boolean, idle: boolean, dragging: boolean): boolean {
  return !reducedMotion && idle && !dragging;
}

/** Radians per second around the vertical axis. One turn takes about 35 seconds. */
export const AUTO_YAW_PER_SEC = 0.18;

/** Crease angle for the grey outline. Box corners stay; nearly flat edges drop out. */
export const OUTLINE_THRESHOLD_DEG = 20;

/** Vertical field of view. About a 35 mm lens, kept fixed while the distance changes. */
export const CAMERA_FOV_DEG = 35;

/**
 * Level 3/4 view. Front is +Z, so this sits front-left and a little above the
 * footprint center. The camera never rolls and never follows a drag.
 */
export const VIEW_DIRECTION = { x: -0.597, y: 0.184, z: 0.781 };

/** Extra distance so a near corner, and the rounded hero, do not clip the house. */
export const FIT_PAD = 1.1;

export interface Vec3 { x: number; y: number; z: number }

export interface CameraPlacement {
  position: Vec3;
  target: Vec3;
  near: number;
  far: number;
  fov: number;
}

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

export function boxCorners(min: Vec3, max: Vec3): Vec3[] {
  const corners: Vec3[] = [];
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) corners.push({ x, y, z });
    }
  }
  return corners;
}

/** Same Y rotation three.js applies to Object3D.rotation.y, around the footprint center. */
export function yawPoint(point: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * point.x + s * point.z, y: point.y, z: -s * point.x + c * point.z };
}

/**
 * Perspective camera that frames the box at every yaw.
 * A corner closer to the lens needs more distance than its size at the pivot, so
 * the fit uses that nearer depth instead of a flat bounding sphere.
 */
export function placeCamera(min: Vec3, max: Vec3, aspect: number, samples = 180): CameraPlacement {
  const pivot: Vec3 = { x: 0, y: (min.y + max.y) / 2, z: 0 };
  const dir = normalize(VIEW_DIRECTION);
  const look = { x: -dir.x, y: -dir.y, z: -dir.z };
  const right = normalize(cross(look, { x: 0, y: 1, z: 0 }));
  const up = cross(right, look);
  const vFov = (CAMERA_FOV_DEG * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * Math.max(aspect, 0.2);
  let dist = 0.5;
  for (const corner of boxCorners(min, max)) {
    for (let i = 0; i < samples; i++) {
      const spun = yawPoint(corner, (i / samples) * Math.PI * 2);
      const offset = { x: spun.x - pivot.x, y: spun.y - pivot.y, z: spun.z - pivot.z };
      const towardCamera = dot(offset, dir);
      const hx = Math.abs(dot(offset, right));
      const hy = Math.abs(dot(offset, up));
      dist = Math.max(dist, towardCamera + hx / tanH, towardCamera + hy / tanV);
    }
  }
  dist *= FIT_PAD;
  return {
    position: { x: pivot.x + dir.x * dist, y: pivot.y + dir.y * dist, z: pivot.z + dir.z * dist },
    target: pivot,
    near: 0.05,
    far: dist + 50,
    fov: CAMERA_FOV_DEG
  };
}

/** Normalized device coordinates for a perspective camera looking at its target. +Y is up. */
export function projectedNdc(point: Vec3, placement: CameraPlacement, aspect: number): { x: number; y: number; depth: number } {
  const look = normalize({
    x: placement.target.x - placement.position.x,
    y: placement.target.y - placement.position.y,
    z: placement.target.z - placement.position.z
  });
  const right = normalize(cross(look, { x: 0, y: 1, z: 0 }));
  const up = cross(right, look);
  const rel = {
    x: point.x - placement.position.x,
    y: point.y - placement.position.y,
    z: point.z - placement.position.z
  };
  const depth = dot(rel, look);
  const vFov = (placement.fov * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * Math.max(aspect, 0.2);
  return { x: dot(rel, right) / (depth * tanH), y: dot(rel, up) / (depth * tanV), depth };
}
