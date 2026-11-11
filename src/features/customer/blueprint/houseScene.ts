import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  type Camera,
  type Material
} from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Raycaster } from "three";
import { colors } from "@/ui/tokens";
import { FACT_EFFECTS, cutawayFor, pickableIds, type Cutaway } from "./houseEffects";
import type { FactId } from "./houseFocus";
import { deriveRooms, type Aabb, type RoomVolume } from "./houseRooms";

const EXPLODE: Record<string, number> = { Ground: -1.15, Upper: 0.9, Roof: 2.2 };
const DETAIL_WITH_UPPER = /^(Balcony_|Minisplit_)/;

interface SavedMat {
  color: string;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

interface Mover {
  obj: Object3D;
  base: number;
  lift: number;
}

interface VolumeMesh {
  id: string;
  level: RoomVolume["level"];
  mesh: Mesh;
  edges: LineSegments2[];
}

export interface PickHit {
  id: string;
  anchor: Vector3;
}

export interface HouseRig {
  dispose: () => void;
  setEffect: (fact: FactId | null, resolution: Vector2) => void;
  setZoom: (id: string | null) => void;
  setPointer: (id: string | null, label: string, anchor: Vector3 | null, reduced: boolean) => void;
  tick: (dt: number, reduced: boolean) => void;
  pick: (ndc: Vector2, camera: Camera) => PickHit | null;
  frame: (id: string | null, fact: FactId | null) => Box3;
}

const PAPER = new Color(colors.paper);
const INK = new Color(colors.ink);

function aabbOf(obj: Object3D): Aabb {
  const box = new Box3().setFromObject(obj);
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z }
  };
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function colorOf(mat: Material): Color | null {
  return "color" in mat && mat.color instanceof Color ? mat.color : null;
}

/** Drop the second Spline root and give the kept copy its authored names back. */
export function keepSingleHouse(root: Object3D): void {
  for (const name of ["santa-sofia-house_2", "santa-sofia-house 2"]) {
    root.getObjectByName(name)?.removeFromParent();
  }
  const kept = root.getObjectByName("santa-sofia-house");
  kept?.traverse((obj) => {
    if (obj === kept || !obj.name.endsWith("_1")) return;
    const base = obj.name.slice(0, -2);
    if (!root.getObjectByName(base)) obj.name = base;
  });
  for (const name of ["Directional_Light", "Default_Ambient_Light"]) {
    root.getObjectByName(name)?.removeFromParent();
  }
}

function fatLines(positions: number[], resolution: Vector2, depthTest: boolean): { lines: LineSegments2[]; dispose: () => void } {
  const mats = [
    new LineMaterial({ color: colors.ink, linewidth: 4.5, toneMapped: false, depthTest }),
    new LineMaterial({ color: colors.accent, linewidth: 2.4, toneMapped: false, depthTest }),
    new LineMaterial({ color: colors.accent, linewidth: 8, transparent: true, opacity: 0.4, toneMapped: false, depthTest })
  ];
  for (const mat of mats) mat.resolution.copy(resolution);
  const lines = mats.map((material) => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    const line = new LineSegments2(geometry, material);
    line.userData.effectProp = true;
    line.computeLineDistances();
    return line;
  });
  return {
    lines,
    dispose: () => {
      for (const line of lines) {
        line.geometry.dispose();
        (line.material as Material).dispose();
      }
    }
  };
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

function makeLabel(text: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const map = new CanvasTexture(canvas);
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colors.mist;
    roundRect(ctx, 8, 24, 496, 80, 40);
    ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.font = "600 52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64, 460);
    map.needsUpdate = true;
  }
  const material = new SpriteMaterial({ map, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new Sprite(material);
  sprite.scale.set(1.35, 0.34, 1);
  sprite.userData.effectProp = true;
  sprite.renderOrder = 6;
  return sprite;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeBadge(n: number): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const map = new CanvasTexture(canvas);
  if (ctx) {
    ctx.fillStyle = colors.mist;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = colors.ink;
    ctx.font = "700 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 64, 68);
    map.needsUpdate = true;
  }
  const material = new SpriteMaterial({ map, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new Sprite(material);
  sprite.scale.set(0.42, 0.42, 1);
  sprite.userData.effectProp = true;
  sprite.renderOrder = 7;
  return sprite;
}

function makeCar(): Group {
  const group = new Group();
  group.userData.effectProp = true;
  const bodyMat = new MeshBasicMaterial({ color: colors.ink });
  const glassMat = new MeshBasicMaterial({ color: colors.inkSoft });
  const body = new Mesh(new BoxGeometry(0.72, 0.28, 1.25), bodyMat);
  body.position.y = 0.28;
  const cabin = new Mesh(new BoxGeometry(0.62, 0.24, 0.62), glassMat);
  cabin.position.set(0, 0.5, -0.08);
  body.userData.effectProp = true;
  cabin.userData.effectProp = true;
  group.add(body, cabin);
  return group;
}

function makePin(): Group {
  const group = new Group();
  group.userData.effectProp = true;
  const ink = new MeshBasicMaterial({ color: colors.ink });
  const lime = new MeshBasicMaterial({ color: colors.accent, depthTest: false });
  const stem = new Mesh(new CylinderGeometry(0.025, 0.025, 0.42, 8), ink);
  stem.position.y = 0.21;
  const head = new Mesh(new SphereGeometry(0.09, 14, 14), ink);
  head.position.y = 0.48;
  const ring = new Mesh(new TorusGeometry(0.13, 0.016, 8, 24), lime);
  ring.position.y = 0.48;
  ring.rotation.x = Math.PI / 2;
  for (const mesh of [stem, head, ring]) mesh.userData.effectProp = true;
  ring.renderOrder = 5;
  group.add(stem, head, ring);
  return group;
}

function measurePositions(box: Aabb, y: number, tick: number): number[] {
  const { min, max } = box;
  const positions = [
    min.x, y, min.z, max.x, y, min.z,
    max.x, y, min.z, max.x, y, max.z,
    max.x, y, max.z, min.x, y, max.z,
    min.x, y, max.z, min.x, y, min.z
  ];
  const corners: Array<[number, number]> = [[min.x, min.z], [max.x, min.z], [max.x, max.z], [min.x, max.z]];
  const dirs: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < corners.length; i++) {
    const [x, z] = corners[i]!;
    const [dx, dz] = dirs[i]!;
    positions.push(x, y, z, x + dx * tick, y, z, x, y, z, x, y, z + dz * tick);
  }
  return positions;
}

function spaceOf(obj: Object3D): string | null {
  let current: Object3D | null = obj;
  while (current) {
    if (typeof current.userData.spaceId === "string") return current.userData.spaceId;
    current = current.parent;
  }
  return null;
}

function descendantOf(obj: Object3D, root: Object3D): boolean {
  let current: Object3D | null = obj;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

export function buildHouseRig(scene: Group, cars: number): HouseRig {
  const disposables: { dispose: () => void }[] = [];
  scene.updateWorldMatrix(true, true);
  const boxes: Record<string, Aabb> = {};
  scene.traverse((obj) => {
    if (obj.name) boxes[obj.name] = aabbOf(obj);
  });
  const volumes = deriveRooms(boxes);
  const resolution = new Vector2(1024, 1024);
  const volumeMeshes: VolumeMesh[] = [];
  const fillMat = new MeshBasicMaterial({
    color: colors.mist,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    toneMapped: false
  });
  disposables.push(fillMat);

  for (const volume of volumes) {
    const size = new Vector3(volume.max.x - volume.min.x, volume.max.y - volume.min.y, volume.max.z - volume.min.z);
    const center = new Vector3(
      (volume.min.x + volume.max.x) / 2,
      (volume.min.y + volume.max.y) / 2,
      (volume.min.z + volume.max.z) / 2
    );
    const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), fillMat);
    mesh.name = volume.id;
    mesh.position.copy(center);
    mesh.userData.spaceId = volume.id;
    mesh.userData.effectProp = true;
    mesh.visible = false;
    mesh.renderOrder = 4;
    const edges = new EdgesGeometry(mesh.geometry, 1);
    const drawn = fatLines(Array.from(edges.getAttribute("position").array as ArrayLike<number>) as unknown as number[], resolution, false);
    edges.dispose();
    disposables.push({ dispose: drawn.dispose });
    for (const line of drawn.lines) mesh.add(line);
    if (volume.tag != null) {
      const badge = makeBadge(volume.tag);
      badge.position.set(0, size.y / 2 + 0.08, 0);
      badge.visible = false;
      mesh.add(badge);
      disposables.push(badge.material, badge.material.map!);
    }
    scene.add(mesh);
    volumeMeshes.push({ id: volume.id, level: volume.level, mesh, edges: drawn.lines });
  }

  const measure = new Group();
  measure.name = "MeasureLines";
  measure.visible = false;
  measure.userData.effectProp = true;
  const footprint = boxes.Ground_Slab ?? boxes.Site_Lot;
  const lot = boxes.Site_Lot;
  if (footprint) {
    const lime = fatLines(measurePositions(footprint, footprint.max.y + 0.06, 0.22), resolution, true);
    disposables.push({ dispose: lime.dispose });
    for (const line of lime.lines) measure.add(line);
  }
  if (lot && lot !== footprint) {
    const ink = fatLines(measurePositions(lot, lot.max.y + 0.03, 0.16), resolution, true);
    for (const line of ink.lines) {
      const mat = line.material as LineMaterial;
      mat.color.set(colors.ink);
      mat.opacity = line === ink.lines[0] ? 1 : 0;
    }
    disposables.push({ dispose: ink.dispose });
    for (const line of ink.lines) measure.add(line);
  }
  scene.add(measure);

  const pins: Group[] = [];
  for (const name of FACT_EFFECTS.minisplits.targets) {
    const host = scene.getObjectByName(name);
    const box = boxes[name];
    if (!host || !box) continue;
    const pin = makePin();
    pin.name = `pin:${name}`;
    pin.userData.spaceId = `pin:${name}`;
    pin.visible = false;
    const top = host.worldToLocal(new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2));
    pin.position.copy(top);
    host.add(pin);
    pins.push(pin);
    disposables.push(...pin.children.flatMap((child) => {
      const mesh = child as Mesh;
      return [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])];
    }));
  }

  const carGroup = new Group();
  carGroup.name = "GarageCars";
  carGroup.visible = false;
  const garage = volumes.find((volume) => volume.id === "Room_Garage");
  const count = Math.max(0, Math.floor(cars));
  if (garage && count > 0) {
    for (let i = 0; i < count; i++) {
      const car = makeCar();
      const x = garage.min.x + (garage.max.x - garage.min.x) * ((i + 1) / (count + 1));
      car.position.set(x, garage.min.y, (garage.min.z + garage.max.z) / 2);
      carGroup.add(car);
      car.traverse((obj) => {
        if (!(obj instanceof Mesh)) return;
        disposables.push(obj.geometry, ...materialsOf(obj));
      });
    }
  }
  scene.add(carGroup);

  const movers: Mover[] = [];
  for (const name of Object.keys(EXPLODE)) {
    const obj = scene.getObjectByName(name);
    if (!obj) continue;
    obj.userData.band = name === "Ground" ? "ground" : name === "Upper" ? "upper" : "roof";
    movers.push({ obj, base: obj.position.y, lift: EXPLODE[name]! });
  }
  const site = scene.getObjectByName("Site");
  if (site) site.userData.band = "site";
  const details = scene.getObjectByName("Details");
  details?.children.forEach((child) => {
    if (DETAIL_WITH_UPPER.test(child.name)) {
      child.userData.band = "upper";
      movers.push({ obj: child, base: child.position.y, lift: EXPLODE.Upper! });
    } else child.userData.band = "ground";
  });

  const callout = new Group();
  callout.name = "BlueprintCallout";
  callout.visible = false;
  callout.userData.effectProp = true;
  const calloutLine = fatLines([0, 0, 0, 1, 0, 0], resolution, false);
  disposables.push({ dispose: calloutLine.dispose });
  for (const line of calloutLine.lines) callout.add(line);
  let labelSprite: Sprite | null = null;
  scene.add(callout);

  const raycaster = new Raycaster();
  let fact: FactId | null = null;
  let zoomId: string | null = null;
  let pointerId: string | null = null;
  let explode = 0;
  let calloutT = 0;
  let calloutGoal = 0;
  const calloutFrom = new Vector3();
  const calloutTo = new Vector3();
  const houseMaxX = footprint ? Math.max(footprint.max.x, lot?.max.x ?? footprint.max.x) : 2;

  const tagged: Object3D[] = [];

  function clearTags(): void {
    for (const obj of tagged) delete obj.userData.spaceId;
    tagged.length = 0;
  }

  function tag(obj: Object3D | undefined, id: string): void {
    if (!obj) return;
    obj.userData.spaceId = id;
    tagged.push(obj);
  }

  function remember(mesh: Mesh): void {
    if (mesh.userData.focusSaved) return;
    const mat = materialsOf(mesh)[0];
    const color = mat ? colorOf(mat) : null;
    if (!mat || !color) return;
    mesh.userData.focusSaved = {
      color: `#${color.getHexString()}`,
      opacity: mat.opacity,
      transparent: mat.transparent,
      depthWrite: mat.depthWrite
    } satisfies SavedMat;
  }

  function clearXray(): void {
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const saved = obj.userData.focusSaved as SavedMat | undefined;
      if (!saved) return;
      for (const mat of materialsOf(obj)) {
        colorOf(mat)?.set(saved.color);
        mat.opacity = saved.opacity;
        mat.transparent = saved.transparent;
        mat.depthWrite = saved.depthWrite;
        mat.needsUpdate = true;
      }
      delete obj.userData.focusSaved;
    });
  }

  function applyExplode(amount: number): void {
    for (const mover of movers) {
      mover.obj.position.y = mover.base + mover.lift * amount;
      mover.obj.updateMatrix();
    }
    explode = amount;
  }

  let floorLines: LineSegments2[] = [];

  function clearFloorGuide(): void {
    for (const line of floorLines) {
      line.removeFromParent();
      line.geometry.dispose();
      (line.material as Material).dispose();
    }
    floorLines = [];
  }

  function showFloorGuide(): void {
    clearFloorGuide();
    for (const name of ["Ground", "Upper", "Roof"]) {
      const host = scene.getObjectByName(name);
      if (!host) continue;
      host.updateWorldMatrix(true, true);
      const world = new Box3().setFromObject(host);
      if (world.isEmpty()) continue;
      const local = world.clone().applyMatrix4(host.matrixWorld.clone().invert());
      const drawn = fatLines(boxPositions(local), resolution, false);
      for (const line of drawn.lines) host.add(line);
      floorLines.push(...drawn.lines);
    }
  }

  function applyCutaway(level: Cutaway): void {
    scene.traverse((obj) => {
      const band = obj.userData.band as string | undefined;
      if (!band) return;
      if (level === "ground") obj.visible = band === "ground" || band === "site";
      else if (level === "upper") obj.visible = band !== "roof";
      else obj.visible = true;
    });
    const doorHidden = fact === "garage";
    scene.traverse((obj) => {
      if (obj.name.startsWith("GarageDoor_Panel")) obj.visible = !doorHidden && obj.parent?.visible !== false;
    });
  }

  function showVolumes(): void {
    const effect = fact ? FACT_EFFECTS[fact] : null;
    const volumeIds = effect && (effect.kind === "volumes" || effect.kind === "garage") ? new Set(effect.targets) : new Set<string>();
    for (const volume of volumeMeshes) {
      const shown = volumeIds.has(volume.id) && (!zoomId || zoomId === volume.id);
      volume.mesh.visible = shown;
      volume.mesh.children.forEach((child) => {
        if (child instanceof Sprite) child.visible = shown && Boolean(effect?.numbered || effect?.kind === "garage");
      });
    }
    measure.visible = effect?.kind === "measure" && !zoomId;
    for (const pin of pins) pin.visible = effect?.kind === "pins";
    carGroup.visible = effect?.kind === "garage" && (!zoomId || zoomId === "Room_Garage");
  }

  function xrayAround(id: string | null): void {
    clearXray();
    if (!id) return;
    const keeps: Object3D[] = [];
    if (id.startsWith("floor:")) {
      const group = scene.getObjectByName(id.slice("floor:".length));
      if (group) keeps.push(group);
    } else if (id.startsWith("pin:")) {
      const host = scene.getObjectByName(id.slice("pin:".length));
      if (host) keeps.push(host);
    } else if (id === "built:footprint") {
      const slab = scene.getObjectByName("Ground_Slab");
      if (slab) keeps.push(slab);
    }
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh) || obj.userData.effectProp) return;
      if (keeps.some((root) => descendantOf(obj, root))) return;
      remember(obj);
      for (const mat of materialsOf(obj)) {
        const color = colorOf(mat);
        if (!color) continue;
        color.copy(INK).lerp(PAPER, 0.72);
        mat.opacity = 0.18;
        mat.transparent = true;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    });
  }

  function placeCallout(label: string, anchor: Vector3 | null): void {
    labelSprite?.parent?.remove(labelSprite);
    if (labelSprite) {
      labelSprite.material.map?.dispose();
      labelSprite.material.dispose();
      labelSprite = null;
    }
    if (!anchor || !label) {
      callout.visible = false;
      calloutGoal = 0;
      return;
    }
    calloutTo.copy(anchor);
    calloutFrom.set(houseMaxX + 0.95, anchor.y, anchor.z);
    labelSprite = makeLabel(label);
    labelSprite.position.copy(calloutFrom);
    scene.add(labelSprite);
    callout.visible = true;
    calloutGoal = 1;
    const positions = calloutLine.lines[0]!.geometry.getAttribute("instanceStart");
    void positions;
    for (const line of calloutLine.lines) {
      const geometry = line.geometry as LineSegmentsGeometry;
      geometry.setPositions([
        calloutFrom.x, calloutFrom.y, calloutFrom.z,
        calloutFrom.x, calloutFrom.y, calloutFrom.z
      ]);
    }
  }

  function applyCallout(t: number): void {
    if (!callout.visible) return;
    const x = calloutFrom.x + (calloutTo.x - calloutFrom.x) * t;
    const y = calloutFrom.y + (calloutTo.y - calloutFrom.y) * t;
    const z = calloutFrom.z + (calloutTo.z - calloutFrom.z) * t;
    for (const line of calloutLine.lines) {
      (line.geometry as LineSegmentsGeometry).setPositions([
        calloutFrom.x, calloutFrom.y, calloutFrom.z,
        x, y, z
      ]);
    }
  }

  const rig: HouseRig = {
    dispose: () => {
      clearXray();
      clearFloorGuide();
      for (const volume of volumeMeshes) volume.mesh.removeFromParent();
      measure.removeFromParent();
      for (const pin of pins) pin.removeFromParent();
      carGroup.removeFromParent();
      callout.removeFromParent();
      labelSprite?.removeFromParent();
      disposables.forEach((item) => item?.dispose?.());
    },
    setEffect: (next, nextResolution) => {
      fact = next;
      resolution.copy(nextResolution);
      scene.traverse((obj) => {
        if (obj instanceof LineSegments2 && obj.material instanceof LineMaterial) obj.material.resolution.copy(nextResolution);
      });
      clearTags();
      if (next) {
        const effect = FACT_EFFECTS[next];
        if (effect.kind === "explode") {
          for (const name of effect.targets) tag(scene.getObjectByName(name), `floor:${name}`);
        } else if (effect.kind === "measure") tag(scene.getObjectByName("Ground_Slab"), "built:footprint");
        else if (effect.kind === "pins") {
          for (const name of effect.targets) tag(scene.getObjectByName(name), `pin:${name}`);
        }
      }
      if (!zoomId) applyCutaway(null);
      showVolumes();
      if (next === "stories" && !zoomId) showFloorGuide();
      else clearFloorGuide();
      applyExplode(next === "stories" && !zoomId ? 1 : 0);
      if (!pointerId) clearXray();
    },
    setZoom: (id) => {
      zoomId = id;
      applyCutaway(id ? cutawayFor(id) : null);
      showVolumes();
      if (fact === "stories" && !id) showFloorGuide();
      else if (id) clearFloorGuide();
      applyExplode(fact === "stories" && !id ? 1 : 0);
    },
    setPointer: (id, label, anchor, reduced) => {
      pointerId = id;
      xrayAround(id);
      const target = anchor ?? (id ? centerOf(id) : null);
      if (reduced) calloutT = id ? 1 : 0;
      else if (id) calloutT = 0;
      placeCallout(label, target);
      if (reduced) applyCallout(calloutT);
    },
    tick: (dt, reduced) => {
      const goal = fact === "stories" && !zoomId ? 1 : 0;
      explode = reduced ? goal : explode + (goal - explode) * Math.min(1, dt * 3.2);
      applyExplode(explode);
      if (pointerId) {
        const live = centerOf(pointerId);
        if (live) calloutTo.copy(live);
      }
      calloutT = reduced ? calloutGoal : calloutT + (calloutGoal - calloutT) * Math.min(1, dt * 4);
      applyCallout(calloutT);
    },
    pick: (ndc, camera) => {
      if (!fact) return null;
      const allowed = new Set(pickableIds(fact));
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(scene, true);
      for (const hit of hits) {
        const id = spaceOf(hit.object);
        if (!id || !allowed.has(id)) continue;
        const anchor = centerOf(id) ?? hit.point.clone();
        return { id, anchor };
      }
      return null;
    },
    frame: (id, nextFact) => {
      const saved = movers.map((mover) => mover.obj.position.y);
      const amount = nextFact === "stories" && !id ? 1 : 0;
      applyExplode(amount);
      scene.updateWorldMatrix(true, true);
      const box = new Box3();
      if (id) {
        scene.traverse((obj) => {
          if (spaceOf(obj) === id && (obj instanceof Mesh || obj instanceof Group)) box.expandByObject(obj);
        });
        for (const volume of volumeMeshes) {
          if (volume.id === id) box.expandByObject(volume.mesh);
        }
      } else if (nextFact === "bedrooms") {
        const upper = scene.getObjectByName("Upper");
        if (upper) box.expandByObject(upper);
      } else if (nextFact === "garage") {
        const mesh = volumeMeshes.find((volume) => volume.id === "Room_Garage");
        if (mesh) box.setFromObject(mesh.mesh);
        box.expandByScalar(0.8);
      } else if (nextFact === "minisplits") {
        for (const pin of pins) box.expandByObject(pin);
        box.expandByScalar(1.1);
      } else box.setFromObject(scene);
      movers.forEach((mover, index) => { mover.obj.position.y = saved[index]!; });
      scene.updateWorldMatrix(true, true);
      if (box.isEmpty()) box.setFromObject(scene);
      return box;
    }
  };

  function centerOf(id: string): Vector3 | null {
    const box = new Box3();
    let found = false;
    scene.traverse((obj) => {
      if (spaceOf(obj) !== id) return;
      if (obj instanceof Mesh || obj instanceof Sprite || obj instanceof Group) {
        box.expandByObject(obj);
        found = true;
      }
    });
    for (const volume of volumeMeshes) {
      if (volume.id !== id) continue;
      box.expandByObject(volume.mesh);
      found = true;
    }
    if (!found || box.isEmpty()) return null;
    return scene.worldToLocal(box.getCenter(new Vector3()));
  }

  return rig;
}
