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

/** sRGB hex to a neutral grey with the same perceived lightness. Drops blue casts in the house materials. */
export function toNeutralGrey(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const y = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
  const channel = y.toString(16).padStart(2, "0");
  return `#${channel}${channel}${channel}`;
}

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
/** Yaw that turns a local point toward the fixed camera. */
export function yawToFace(point: Vec3): number {
  return Math.atan2(VIEW_DIRECTION.x, VIEW_DIRECTION.z) - Math.atan2(point.x, point.z);
}

/**
 * Frame one box at its current orientation. A positive ndcBiasX shifts the
 * subject to the right so a left-hand HUD does not cover it.
 */
export function fitCameraOnce(min: Vec3, max: Vec3, aspect: number, ndcBiasX = 0, options?: { distanceScale?: number; elevate?: number }): CameraPlacement {
  const pivot: Vec3 = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const dir = normalize({ ...VIEW_DIRECTION, y: VIEW_DIRECTION.y + (options?.elevate ?? 0) });
  const look = { x: -dir.x, y: -dir.y, z: -dir.z };
  const right = normalize(cross(look, { x: 0, y: 1, z: 0 }));
  const up = cross(right, look);
  const vFov = (CAMERA_FOV_DEG * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * Math.max(aspect, 0.2);
  let dist = 0.5;
  for (const corner of boxCorners(min, max)) {
    const offset = { x: corner.x - pivot.x, y: corner.y - pivot.y, z: corner.z - pivot.z };
    const towardCamera = dot(offset, dir);
    const hx = Math.abs(dot(offset, right));
    const hy = Math.abs(dot(offset, up));
    dist = Math.max(dist, towardCamera + hx / tanH, towardCamera + hy / tanV);
  }
  dist *= FIT_PAD * (options?.distanceScale ?? 1);
  const shift = dist * tanH * ndcBiasX;
  const target = { x: pivot.x - right.x * shift, y: pivot.y, z: pivot.z - right.z * shift };
  return {
    position: { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist },
    target,
    near: 0.05,
    far: dist + 80,
    fov: CAMERA_FOV_DEG
  };
}

export function placeCamera(min: Vec3, max: Vec3, aspect: number, samples = 180, ndcBiasX = 0): CameraPlacement {
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
  const shift = dist * tanH * ndcBiasX;
  const target = { x: pivot.x - right.x * shift, y: pivot.y, z: pivot.z - right.z * shift };
  return {
    position: { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist },
    target,
    near: 0.05,
    far: dist + 50,
    fov: CAMERA_FOV_DEG
  };
}

/** Left edge, in NDC, that stays 16px right of the tablet HUD plate. */
export function hudClearNdc(canvasWidth: number): number {
  const plate = Math.min(340, Math.max(0, canvasWidth - 40));
  // 16px of clearance, plus the outline stroke that sits outside the mesh box.
  const clearPx = 20 + plate + 28;
  return (clearPx / Math.max(canvasWidth, 1)) * 2 - 1;
}

function cameraDistance(placement: CameraPlacement): number {
  return Math.hypot(
    placement.position.x - placement.target.x,
    placement.position.y - placement.target.y,
    placement.position.z - placement.target.z
  ) || 1;
}

function withDistance(placement: CameraPlacement, scale: number): CameraPlacement {
  const dx = placement.position.x - placement.target.x;
  const dy = placement.position.y - placement.target.y;
  const dz = placement.position.z - placement.target.z;
  return {
    ...placement,
    position: {
      x: placement.target.x + dx * scale,
      y: placement.target.y + dy * scale,
      z: placement.target.z + dz * scale
    },
    far: placement.far * scale + 20
  };
}

/** Slide the subject right. Positive bias matches fitCameraOnce. */
export function shiftSubject(placement: CameraPlacement, aspect: number, ndcBiasX: number): CameraPlacement {
  if (Math.abs(ndcBiasX) < 1e-4) return placement;
  const dist = cameraDistance(placement);
  const dir = normalize({
    x: (placement.position.x - placement.target.x) / dist,
    y: (placement.position.y - placement.target.y) / dist,
    z: (placement.position.z - placement.target.z) / dist
  });
  const look = { x: -dir.x, y: -dir.y, z: -dir.z };
  const right = normalize(cross(look, { x: 0, y: 1, z: 0 }));
  const tanH = Math.tan((placement.fov * Math.PI) / 180 / 2) * Math.max(aspect, 0.2);
  const shift = dist * tanH * ndcBiasX;
  const target = {
    x: placement.target.x - right.x * shift,
    y: placement.target.y,
    z: placement.target.z - right.z * shift
  };
  return {
    ...placement,
    target,
    position: { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist }
  };
}

function horizontalExtents(min: Vec3, max: Vec3, placement: CameraPlacement, aspect: number, yaws: number[]): { left: number; right: number } {
  let left = Infinity;
  let right = -Infinity;
  for (const yaw of yaws) {
    for (const corner of boxCorners(min, max)) {
      const ndc = projectedNdc(yawPoint(corner, yaw), placement, aspect);
      left = Math.min(left, ndc.x);
      right = Math.max(right, ndc.x);
    }
  }
  return { left, right };
}

/**
 * On a tablet the HUD covers the left of the viewport. Pull the camera back
 * and slide the subject right until every given yaw stays 16px clear of the plate.
 */
export function clearBesideHud(min: Vec3, max: Vec3, aspect: number, canvasWidth: number, placement: CameraPlacement, yaw = 0, spin = false): CameraPlacement {
  const clear = hudClearNdc(canvasWidth);
  const rightLimit = 0.96;
  const yaws = spin ? [yaw, yaw - 0.35, yaw + 0.35] : [yaw];
  let scale = 1;
  let current = placement;
  for (let i = 0; i < 8; i++) {
    const pulled = withDistance(placement, scale);
    const ext = horizontalExtents(min, max, pulled, aspect, yaws);
    const width = Math.max(ext.right - ext.left, 0.05);
    const available = rightLimit - clear;
    if (width > available) {
      scale *= (width / available) * 1.06;
      continue;
    }
    current = shiftSubject(pulled, aspect, clear - ext.left);
    const after = horizontalExtents(min, max, current, aspect, yaws);
    if (after.left >= clear - 0.02 && after.right <= rightLimit + 0.02) return current;
    scale *= 1.1;
  }
  return current;
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
