import {
  Box3,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  type Material,
  type Object3D
} from "three";
import { colors } from "@/ui/tokens";
import { hidesForCutaway, matchesFact, usesCutaway, type FactId } from "./houseFocus";

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

/** Drop the lime edges and give every mesh its own color back. */
export function clearHouseFocus(root: Object3D): void {
  const lines = (root.userData.focusLines as LineSegments[] | undefined) ?? [];
  const geometries = new Set<EdgesGeometry>();
  for (const line of lines) {
    geometries.add(line.geometry as EdgesGeometry);
    line.parent?.remove(line);
    (line.material as Material).dispose();
  }
  geometries.forEach((geometry) => geometry.dispose());
  root.userData.focusLines = [];
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

function addEdges(root: Object3D, mesh: Mesh): void {
  const edges = new EdgesGeometry(mesh.geometry, 20);
  const charcoal = new LineSegments(edges, new LineBasicMaterial({ color: colors.ink, toneMapped: false }));
  charcoal.scale.setScalar(1.02);
  const lime = new LineSegments(edges, new LineBasicMaterial({ color: colors.accent, toneMapped: false }));
  const glow = new LineSegments(edges, new LineBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.55, toneMapped: false }));
  glow.scale.setScalar(1.045);
  for (const line of [charcoal, lime, glow]) mesh.add(line);
  const list = (root.userData.focusLines as LineSegments[] | undefined) ?? [];
  list.push(charcoal, lime, glow);
  root.userData.focusLines = list;
}

export interface FocusFrame {
  meshes: Mesh[];
  /** False when the cutaway had nothing to outline, so the camera only frames the floor. */
  outlined: boolean;
}

/**
 * Fade the rest of the house toward paper and outline the fact.
 * Bedrooms and bathrooms hide the roof and the front upper wall first.
 * Returns the meshes the camera should frame.
 */
export function applyHouseFocus(root: Object3D, fact: FactId): FocusFrame {
  clearHouseFocus(root);
  const cutaway = usesCutaway(fact);
  const matched: Mesh[] = [];
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    if (cutaway && hidesForCutaway(obj.name)) {
      obj.visible = false;
      return;
    }
    if (matchesFact(obj.name, fact)) matched.push(obj);
  });
  const outlined = matched.length > 0;
  const framed = outlined ? matched : floorMeshes(root, fact);
  root.traverse((obj) => {
    if (!(obj instanceof Mesh) || !obj.visible) return;
    remember(obj);
    const hit = outlined && matched.includes(obj);
    for (const mat of materialsOf(obj)) {
      const color = colorOf(mat);
      if (hit) {
        const saved = obj.userData.focusSaved as SavedMat | undefined;
        if (saved && color) color.set(saved.color);
        mat.opacity = saved?.opacity ?? 1;
        mat.transparent = saved?.transparent ?? false;
      } else if (color) {
        color.lerp(PAPER, 0.5);
        mat.opacity = 0.5;
        mat.transparent = true;
      }
      mat.needsUpdate = true;
    }
    if (hit) addEdges(root, obj);
  });
  return { meshes: framed.length > 0 ? framed : matched, outlined };
}

function floorMeshes(root: Object3D, fact: FactId): Mesh[] {
  const prefix = fact === "bedrooms" ? "Upper" : "Ground";
  const found: Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof Mesh && (obj.name === prefix || obj.name.startsWith(`${prefix}_`)) && obj.visible) found.push(obj);
  });
  return found;
}

/** World box of the framed meshes. Empty when the house has not been measured yet. */
export function frameBox(meshes: Mesh[]): Box3 {
  const box = new Box3();
  for (const mesh of meshes) box.expandByObject(mesh);
  return box;
}
