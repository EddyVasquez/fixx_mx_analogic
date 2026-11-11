import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Group,
  type Material,
  type PerspectiveCamera
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { colors } from "@/ui/tokens";
import {
  AUTO_YAW_PER_SEC,
  CAMERA_FOV_DEG,
  HOUSE_MODEL_URL,
  OUTLINE_THRESHOLD_DEG,
  clearBesideHud,
  dollhousePlacement,
  fitCameraOnce,
  placeCamera,
  shouldAutoRotate,
  toNeutralGrey,
  type Vec3
} from "./houseModel";
import { buildHouseRig, keepSingleHouse, type HouseRig, type PickHit } from "./houseScene";
import { labelKey, tradeForSpace } from "./houseEffects";
import type { FactId } from "./houseFocus";
import { categories } from "../data";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";

const OUTLINE = "#404040";

interface Motion {
  yaw: number;
  dragging: boolean;
  idle: boolean;
}

function isGlass(mat: Material): boolean {
  return mat.name === "Glass";
}

function tuneMaterial(source: Material): Material {
  if (source instanceof MeshStandardMaterial && source.name === "Site_Light") {
    return new MeshBasicMaterial({ name: "Site_Light", color: colors.paper, toneMapped: false });
  }
  const mat = source.clone();
  if (mat instanceof MeshStandardMaterial) mat.color.set(toNeutralGrey(mat.color.getHexString()));
  if (mat instanceof MeshStandardMaterial && !isGlass(mat)) {
    mat.roughness = 1;
    mat.metalness = 0;
    mat.envMapIntensity = 0;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
  }
  if (mat instanceof MeshStandardMaterial && isGlass(mat)) {
    mat.transparent = true;
    mat.depthWrite = false;
    mat.metalness = 0;
  }
  mat.needsUpdate = true;
  return mat;
}

interface Dressed {
  scene: Group;
  rig: HouseRig;
  bounds: { min: Vec3; max: Vec3 };
  dispose: () => void;
}

function dress(source: Group, cars: number): Dressed {
  const scene = source.clone(true);
  keepSingleHouse(scene);
  const outline = new LineBasicMaterial({ color: OUTLINE, toneMapped: false });
  const disposables: { dispose: () => void }[] = [outline];
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = list.map((mat) => tuneMaterial(mat));
    disposables.push(...next);
    obj.material = Array.isArray(obj.material) ? next : next[0]!;
    const glass = next.some(isGlass);
    const site = next.some((mat) => mat.name === "Site_Light");
    obj.castShadow = !glass && !site;
    obj.receiveShadow = !glass && !site;
    if (site) return;
    if (glass) {
      obj.renderOrder = 2;
      return;
    }
    const edges = new EdgesGeometry(obj.geometry, OUTLINE_THRESHOLD_DEG);
    disposables.push(edges);
    const lines = new LineSegments(edges, outline);
    lines.renderOrder = 3;
    obj.add(lines);
  });
  scene.updateWorldMatrix(true, true);
  const rig = buildHouseRig(scene, cars);
  const box = new Box3().setFromObject(scene);
  return {
    scene,
    rig,
    bounds: {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z }
    },
    dispose: () => {
      rig.dispose();
      disposables.forEach((item) => item.dispose());
    }
  };
}

function KeyLight() {
  const light = useRef<DirectionalLight>(null);
  useLayoutEffect(() => {
    const cam = light.current?.shadow.camera;
    if (!cam) return;
    cam.left = -12;
    cam.right = 12;
    cam.top = 12;
    cam.bottom = -12;
    cam.near = 0.5;
    cam.far = 48;
    cam.updateProjectionMatrix();
  }, []);
  return (
    <directionalLight
      ref={light}
      position={[-7, 12, 9]}
      intensity={1.25}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.00035}
      shadow-normalBias={0.04}
    />
  );
}

function FadingGrid({ y }: { y: number }) {
  const material = useMemo(() => new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uColor: { value: new Color("#6A6A6A") },
      uCell: { value: 1 },
      uFade: { value: 13 },
      uStrength: { value: 0.55 }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 uColor;
      uniform float uCell;
      uniform float uFade;
      uniform float uStrength;
      void main() {
        vec2 coord = vWorld.xz / uCell;
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
        float line = min(grid.x, grid.y);
        float mask = 1.0 - min(line, 1.0);
        float dist = length(vWorld.xz);
        float fade = 1.0 - smoothstep(uFade * 0.35, uFade, dist);
        float alpha = mask * fade * uStrength;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  }), []);
  useEffect(() => () => { material.dispose(); }, [material]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[48, 48]} />
    </mesh>
  );
}

function ContactShadow({ y }: { y: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const fade = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
    fade.addColorStop(0, "rgba(30, 30, 30, 0.42)");
    fade.addColorStop(0.38, "rgba(30, 30, 30, 0.2)");
    fade.addColorStop(0.68, "rgba(30, 30, 30, 0.06)");
    fade.addColorStop(1, "rgba(30, 30, 30, 0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 256, 256);
    const map = new CanvasTexture(canvas);
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(() => () => { texture?.dispose(); }, [texture]);
  if (!texture) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0.4]} renderOrder={2}>
      <planeGeometry args={[8, 14]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function HouseModel({ cars, onScene }: { cars: number; onScene: (scene: Dressed | null) => void }) {
  const gltf = useLoader(GLTFLoader, HOUSE_MODEL_URL);
  const dressed = useMemo(() => dress(gltf.scene, cars), [cars, gltf]);
  useEffect(() => {
    onScene(dressed);
    return () => {
      onScene(null);
      dressed.dispose();
    };
  }, [dressed, onScene]);
  return (
    <group>
      <primitive object={dressed.scene} />
      <ContactShadow y={dressed.bounds.min.y + 0.02} />
    </group>
  );
}

interface Shot {
  fromYaw: number;
  toYaw: number;
  fromPos: Vector3;
  toPos: Vector3;
  fromLook: Vector3;
  toLook: Vector3;
  start: number;
  ms: number;
  done: boolean;
}

function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

function Scene({ motion, reduced, draw, focus, zoom, pointer, pointerLabel, cars, wide, tablet, onClear, onZoom, onHover }: {
  motion: MutableRefObject<Motion>;
  reduced: boolean;
  draw: MutableRefObject<() => void>;
  focus: FactId | null;
  zoom: PickHit | null;
  pointer: PickHit | null;
  pointerLabel: string;
  cars: number;
  wide: boolean;
  /** 768–1023. The HUD covers the house here, so the default view shifts right too. */
  tablet: boolean;
  onClear?: () => void;
  onZoom: (hit: PickHit | null) => void;
  onHover: (hit: PickHit | null) => void;
}) {
  const group = useRef<Group>(null);
  const [house, setHouse] = useState<Dressed | null>(null);
  const shot = useRef<Shot | null>(null);
  const framed = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const idleRef = useRef(motion);
  const clearRef = useRef(onClear);
  const zoomRef = useRef(onZoom);
  const hoverRef = useRef(onHover);
  const focusRef = useRef(focus);
  const houseRef = useRef(house);
  const zoomedRef = useRef(zoom);
  clearRef.current = onClear;
  zoomRef.current = onZoom;
  hoverRef.current = onHover;
  focusRef.current = focus;
  houseRef.current = house;
  zoomedRef.current = zoom;

  useEffect(() => { draw.current = invalidate; }, [draw, invalidate]);

  useLayoutEffect(() => {
    house?.rig.setPointer(pointer?.id ?? null, pointerLabel, pointer?.anchor ?? null, reduced);
    invalidate();
  }, [house, invalidate, pointer, pointerLabel, reduced]);

  useEffect(() => {
    gl.shadowMap.type = PCFSoftShadowMap;
    gl.domElement.tabIndex = -1;
    gl.domElement.setAttribute("aria-hidden", "true");
    gl.domElement.style.touchAction = "none";
    invalidate();
  }, [gl, invalidate]);

  const ndcOf = (event: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    return new Vector2(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    );
  };

  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    let moved = 0;
    let resume = 0;
    const down = (event: PointerEvent) => {
      resume += 1;
      moved = 0;
      idleRef.current.current.dragging = true;
      idleRef.current.current.idle = false;
      lastX = event.clientX;
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const current = idleRef.current.current;
      if (event.pointerType === "mouse" && !current.dragging && focusRef.current) {
        const hit = houseRef.current?.rig.pick(ndcOf(event), camera) ?? null;
        hoverRef.current(hit);
      }
      if (!current.dragging) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      moved += Math.abs(dx);
      current.yaw += dx * 0.01;
      invalidate();
    };
    const up = (event: PointerEvent) => {
      const current = idleRef.current.current;
      if (!current.dragging) return;
      current.dragging = false;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      const token = ++resume;
      if (moved < 6 && focusRef.current) {
        const hit = houseRef.current?.rig.pick(ndcOf(event), camera) ?? null;
        if (hit) zoomRef.current(hit);
        else if (zoomedRef.current) zoomRef.current(null);
        else clearRef.current?.();
      } else if (moved < 6) clearRef.current?.();
      window.setTimeout(() => { if (token === resume && !focusRef.current) current.idle = true; }, focusRef.current ? 4000 : 1600);
      invalidate();
    };
    const leave = () => hoverRef.current(null);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
    };
  }, [camera, gl, invalidate]);

  useLayoutEffect(() => {
    const pivot = group.current;
    if (!house || !pivot || size.width < 2 || size.height < 2) return;
    const aspect = size.width / size.height;
    const resolution = new Vector2(size.width, size.height);
    house.rig.setEffect(focus, resolution);
    house.rig.setZoom(zoom?.id ?? null);
    const savedYaw = pivot.rotation.y;
    pivot.rotation.y = 0;
    pivot.updateWorldMatrix(true, true);
    const toYaw = 0;
    const hudBias = tablet ? 0 : focus && wide && !zoom ? 0.28 : 0;
    const box = house.rig.frame(zoom?.id ?? null, focus);
    if (!zoom && (focus === "bathrooms" || focus === "bedrooms")) box.expandByScalar(0.8);
    const framedMin = { x: box.min.x, y: box.min.y, z: box.min.z };
    const framedMax = { x: box.max.x, y: box.max.y, z: box.max.z };
    let placement = zoom
      ? dollhousePlacement(framedMin, framedMax)
      : focus
        ? fitCameraOnce(framedMin, framedMax, aspect, hudBias, {
          distanceScale: focus === "minisplits" ? 1.15 : focus === "built" ? 1.35 : focus === "stories" ? 1.15 : 1,
          elevate: focus === "built" ? 0.55 : 0
        })
        : placeCamera(framedMin, framedMax, aspect, 180, hudBias);
    if (tablet) {
      placement = clearBesideHud(framedMin, framedMax, aspect, size.width, placement, 0, !focus && !zoom);
    }
    pivot.rotation.y = savedYaw;
    pivot.updateWorldMatrix(true, true);
    const ms = !framed.current || reduced ? 0 : 700;
    framed.current = true;
    const fromPos = camera.position.clone();
    const fromLook = new Vector3();
    camera.getWorldDirection(fromLook);
    const lookNow = fromPos.clone().add(fromLook);
    const toPos = new Vector3(placement.position.x, placement.position.y, placement.position.z);
    const toLook = new Vector3(placement.target.x, placement.target.y, placement.target.z);
    camera.fov = placement.fov;
    camera.near = placement.near;
    camera.far = placement.far;
    if (ms === 0) {
      camera.position.copy(toPos);
      camera.lookAt(toLook);
      motion.current.yaw = toYaw;
      pivot.rotation.y = toYaw;
      camera.updateProjectionMatrix();
      shot.current = { fromYaw: toYaw, toYaw, fromPos: toPos, toPos, fromLook: toLook, toLook, start: 0, ms: 0, done: true };
    } else {
      shot.current = { fromYaw: motion.current.yaw, toYaw, fromPos, toPos, fromLook: lookNow, toLook, start: performance.now(), ms, done: false };
    }
    invalidate();
  }, [camera, focus, house, invalidate, motion, reduced, size.height, size.width, tablet, wide, zoom]);

  useFrame((_, delta) => {
    const current = motion.current;
    const anim = shot.current;
    if (anim && !anim.done) {
      const t = Math.min(1, (performance.now() - anim.start) / anim.ms);
      const k = t * t * (3 - 2 * t);
      current.yaw = lerpAngle(anim.fromYaw, anim.toYaw, k);
      camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
      camera.lookAt(anim.fromLook.clone().lerp(anim.toLook, k));
      if (t >= 1) anim.done = true;
    } else if (shouldAutoRotate(reduced, current.idle, current.dragging)) {
      current.yaw += delta * AUTO_YAW_PER_SEC;
    }
    if (group.current) group.current.rotation.y = current.yaw;
    house?.rig.tick(delta, reduced);
  });

  return (
    <>
      <color attach="background" args={[colors.paper]} />
      <hemisphereLight args={[colors.mist, colors.paper, 2.05]} />
      <KeyLight />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, (house?.bounds.min.y ?? -0.4) - 0.04, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color={colors.paper} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, (house?.bounds.min.y ?? -0.4) - 0.02, 0]} receiveShadow renderOrder={1}>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.28} transparent />
      </mesh>
      <FadingGrid y={(house?.bounds.min.y ?? -0.4) - 0.01} />
      <group ref={group}>
        <HouseModel cars={cars} onScene={setHouse} />
      </group>
    </>
  );
}

useLoader.preload(GLTFLoader, HOUSE_MODEL_URL);

export default function HouseBlueprint({ label, focus = null, wide = false, tablet = false, cars = 1, onClear, onAnnounce, onRequest }: {
  label: string;
  focus?: FactId | null;
  /** 768 and up. A selected fact is framed to the right of the HUD. */
  wide?: boolean;
  /** 768–1023. The default view is framed to the right of the HUD as well. */
  tablet?: boolean;
  /** Parking spaces drawn inside the garage. */
  cars?: number;
  onClear?: () => void;
  onAnnounce?: (text: string) => void;
  onRequest?: (categoryId: string, roomLabel: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en") as Lang;
  const motion = useRef<Motion>({ yaw: 0, dragging: false, idle: true });
  const draw = useRef<() => void>(() => {});
  const [zoom, setZoom] = useState<PickHit | null>(null);
  const [hot, setHot] = useState<PickHit | null>(null);
  const onHover = useCallback((hit: PickHit | null) => {
    setHot((current) => (current?.id === hit?.id ? current : hit));
  }, []);
  const pointer = zoom ?? hot;
  const pointerLabel = pointer ? t(labelKey(pointer.id)) : "";
  const trade = zoom ? tradeForSpace(zoom.id) : null;
  const tradeName = categories.find((item) => item.id === trade)?.names[lang] ?? trade ?? "";

  useEffect(() => { setZoom(null); setHot(null); }, [focus]);
  useEffect(() => { onAnnounce?.(pointerLabel); }, [onAnnounce, pointerLabel]);
  const [reduced, setReduced] = useState(() => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [hidden, setHidden] = useState(false);
  const skipIdle = useRef(true);

  useEffect(() => {
    if (skipIdle.current) {
      skipIdle.current = false;
      return;
    }
    if (focus) {
      motion.current.idle = false;
      return;
    }
    const timer = window.setTimeout(() => { motion.current.idle = true; }, 4000);
    return () => window.clearTimeout(timer);
  }, [focus]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = Math.PI / 12;
    const current = motion.current;
    if (event.key === "ArrowLeft") current.yaw -= step;
    else if (event.key === "ArrowRight") current.yaw += step;
    else return;
    event.preventDefault();
    current.idle = false;
    window.setTimeout(() => { current.idle = true; }, 1600);
    draw.current();
  };

  return (
    <div
      role="application"
      aria-label={label}
      tabIndex={0}
      data-blueprint="live"
      className="relative h-full w-full touch-none bg-paper"
      onKeyDown={onKey}
    >
      {zoom && (
        <button type="button" className="cockpit-back min-h-touch" onClick={() => setZoom(null)}>
          <ArrowLeft size={18} aria-hidden="true" />
          {t("myhome.hub.backHome")}
        </button>
      )}
      {zoom && trade && (
        <button
          type="button"
          className="cockpit-request min-h-touch"
          onClick={() => onRequest?.(trade, t(labelKey(zoom.id)))}
        >
          {t("myhome.hub.requestHere", { trade: tradeName })}
        </button>
      )}
      <Canvas
        flat
        frameloop={reduced || hidden ? "demand" : "always"}
        dpr={[1, 2]}
        shadows="soft"
        camera={{ fov: CAMERA_FOV_DEG, position: [-8, 5, 14], near: 0.05, far: 200 }}
        gl={{ antialias: true, powerPreference: "low-power", alpha: false }}
      >
        <Scene
          motion={motion}
          reduced={reduced || hidden}
          draw={draw}
          focus={focus}
          zoom={zoom}
          pointer={pointer}
          pointerLabel={pointerLabel}
          cars={cars}
          wide={wide}
          tablet={tablet}
          onClear={onClear}
          onZoom={setZoom}
          onHover={onHover}
        />
      </Canvas>
    </div>
  );
}
