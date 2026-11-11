import {
  Box3,
  Color,
  EdgesGeometry,
  Mesh,
  Vector2,
  type Material,
  type Object3D
} from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { colors } from "@/ui/tokens";
import { focusMode, matchesFact, type FactId } from "./houseFocus";

interface SavedMat {
  color: string;
  opacity: number;
  transparent: boolean;
}

const PAPER = new Color(colors.paper);

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function colorOf(mat: Material): Color | null {
  return "color" in mat && mat.color instanceof Color ? mat.color : null;
}

function meshesNamed(root: Object3D, fact: FactId): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof Mesh && matchesFact(obj.name, fact)) found.push(obj);
  });
  return found;
}

/** Drop the lime edges and give every mesh its own color back. */
export function clearHouseFocus(root: Object3D): void {
  const lines = (root.userData.focusLines as LineSegments2[] | undefined) ?? [];
  for (const line of lines) {
    line.parent?.remove(line);
    line.geometry.dispose();
    (line.material as Material).dispose();
  }
  root.userData.focusLines = [];
  root.userData.focusLineMaterials = [];
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.visible = true;
    const saved = obj.userData.focusSaved as SavedMat | undefined;
    if (!saved) return;
    for (const mat of materialsOf(obj)) {
      colorOf(mat)?.set(saved.color);
      mat.opacity = saved.opacity;
      mat.transparent = saved.transparent;
      mat.needsUpdate = true;
    }
    delete obj.userData.focusSaved;
  });
}

function remember(mesh: Mesh): void {
  if (mesh.userData.focusSaved) return;
  const mat = materialsOf(mesh)[0];
  const color = mat ? colorOf(mat) : null;
  if (!mat || !color) return;
  mesh.userData.focusSaved = { color: `#${color.getHexString()}`, opacity: mat.opacity, transparent: mat.transparent } satisfies SavedMat;
}

function track(root: Object3D, line: LineSegments2): void {
  const list = (root.userData.focusLines as LineSegments2[] | undefined) ?? [];
  list.push(line);
  root.userData.focusLines = list;
}

function fatMaterial(color: string, width: number, opacity: number, resolution: Vector2): LineMaterial {
  const material = new LineMaterial({
    color,
    linewidth: width,
    transparent: opacity < 1,
    opacity,
    toneMapped: false,
    depthTest: true
  });
  material.resolution.copy(resolution);
  return material;
}

function addFat(root: Object3D, parent: Object3D, positions: ArrayLike<number>, resolution: Vector2): void {
  const mats = [
    fatMaterial(colors.ink, 4.5, 1, resolution),
    fatMaterial(colors.accent, 2.5, 1, resolution),
    fatMaterial(colors.accent, 9, 0.45, resolution)
  ];
  const stored = (root.userData.focusLineMaterials as LineMaterial[] | undefined) ?? [];
  stored.push(...mats);
  root.userData.focusLineMaterials = stored;
  for (const material of mats) {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions as unknown as number[]);
    const line = new LineSegments2(geometry, material);
    line.computeLineDistances();
    parent.add(line);
    track(root, line);
  }
}

function addMeshEdges(root: Object3D, mesh: Mesh, resolution: Vector2): void {
  const edges = new EdgesGeometry(mesh.geometry, 20);
  const positions = edges.getAttribute("position").array;
  addFat(root, mesh, positions, resolution);
  edges.dispose();
}

function localBox(root: Object3D, meshes: Mesh[]): Box3 {
  const world = new Box3();
  for (const mesh of meshes) world.expandByObject(mesh);
  const inverse = root.matrixWorld.clone().invert();
  return world.applyMatrix4(inverse);
}

function boxPositions(box: Box3): number[] {
  const { min, max } = box;
  const corners = [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, max.y, min.z], [min.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [max.x, max.y, max.z], [min.x, max.y, max.z]
  ];
  const pairs: ReadonlyArray<readonly [number, number]> = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const positions: number[] = [];
  for (const [a, b] of pairs) positions.push(...corners[a]!, ...corners[b]!);
  return positions;
}

function addBoxOutline(root: Object3D, meshes: Mesh[], resolution: Vector2): void {
  if (meshes.length === 0) return;
  const box = localBox(root, meshes);
  if (box.isEmpty()) return;
  addFat(root, root, boxPositions(box), resolution);
}

function fadeExcept(root: Object3D, keep: Set<Mesh>): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh) || keep.has(obj)) return;
    remember(obj);
    for (const mat of materialsOf(obj)) {
      const color = colorOf(mat);
      if (!color) continue;
      color.lerp(PAPER, 0.5);
      mat.opacity = 0.5;
      mat.transparent = true;
      mat.needsUpdate = true;
    }
  });
}

export interface FocusFrame {
  meshes: Mesh[];
  outlined: boolean;
}

/**
 * Stories draws one box per floor. Built draws the ground slab.
 * Bedrooms and bathrooms only choose a volume to frame; the callout names them.
 */
export function applyHouseFocus(root: Object3D, fact: FactId, resolution: Vector2): FocusFrame {
  clearHouseFocus(root);
  const matched = meshesNamed(root, fact);
  const mode = focusMode(fact);
  if (mode === "frame") return { meshes: matched, outlined: false };
  if (mode === "bands") {
    const ground = matched.filter((mesh) => mesh.name === "Ground" || mesh.name.startsWith("Ground_"));
    const upper = matched.filter((mesh) => mesh.name === "Upper" || mesh.name.startsWith("Upper_"));
    fadeExcept(root, new Set([...ground, ...upper]));
    addBoxOutline(root, ground, resolution);
    addBoxOutline(root, upper, resolution);
    return { meshes: [...ground, ...upper], outlined: true };
  }
  if (mode === "slab") {
    fadeExcept(root, new Set(matched));
    addBoxOutline(root, matched, resolution);
    return { meshes: matched, outlined: true };
  }
  fadeExcept(root, new Set(matched));
  for (const mesh of matched) addMeshEdges(root, mesh, resolution);
  return { meshes: matched, outlined: matched.length > 0 };
}

/** World box of the framed meshes. Empty when the house has not been measured yet. */
export function frameBox(meshes: Mesh[]): Box3 {
  const box = new Box3();
  for (const mesh of meshes) box.expandByObject(mesh);
  if (!box.isEmpty()) box.expandByScalar(0.35);
  return box;
}
