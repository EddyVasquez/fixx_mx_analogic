import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
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
  MeshStandardMaterial,
  PCFSoftShadowMap,
  ShaderMaterial,
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
  placeCamera,
  shouldAutoRotate,
  type Vec3
} from "./houseModel";

const OUTLINE = colors.charcoal;

interface Motion {
  yaw: number;
  dragging: boolean;
  idle: boolean;
}

function isGlass(mat: Material): boolean {
  return mat.name === "Glass";
}

/** sRGB average. GLTF colors above this are treated as too close to the removed surface. */
function srgbAverage(color: Color): number {
  const srgb = color.clone().convertLinearToSRGB();
  return (srgb.r + srgb.g + srgb.b) / 3;
}

function tuneMaterial(source: Material): Material {
  const mat = source.clone();
  if (mat instanceof MeshStandardMaterial && isGlass(mat)) {
    mat.color.set(colors.hlOk);
    mat.transparent = true;
    mat.depthWrite = false;
    mat.metalness = 0;
  } else if (mat instanceof MeshStandardMaterial) {
    if (mat.name === "Trim_Charcoal") mat.color.set(colors.charcoal);
    else if (mat.name === "Site_Light") mat.color.set(colors.mist);
    else if (mat.name === "Wall_Grey" || srgbAverage(mat.color) > 0.82) mat.color.set(colors.hlOk);
    mat.roughness = 1;
    mat.metalness = 0;
    mat.envMapIntensity = 0;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
  }
  mat.needsUpdate = true;
  return mat;
}

interface Dressed {
  scene: Group;
  bounds: { min: Vec3; max: Vec3 };
  dispose: () => void;
}

function dress(source: Group): Dressed {
  const scene = source.clone(true);
  const outline = new LineBasicMaterial({ color: OUTLINE, toneMapped: false });
  const disposables: { dispose: () => void }[] = [outline];
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = list.map((mat) => tuneMaterial(mat));
    disposables.push(...next);
    obj.material = Array.isArray(obj.material) ? next : next[0]!;
    const glass = next.some(isGlass);
    obj.castShadow = !glass;
    obj.receiveShadow = !glass;
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
  const box = new Box3().setFromObject(scene);
  return {
    scene,
    bounds: {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z }
    },
    dispose: () => { disposables.forEach((item) => item.dispose()); }
  };
}

function FitCamera({ bounds }: { bounds: { min: Vec3; max: Vec3 } }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (size.width < 2 || size.height < 2) return;
    const placement = placeCamera(bounds.min, bounds.max, size.width / size.height);
    camera.fov = placement.fov;
    camera.position.set(placement.position.x, placement.position.y, placement.position.z);
    camera.near = placement.near;
    camera.far = placement.far;
    camera.lookAt(placement.target.x, placement.target.y, placement.target.z);
    camera.updateProjectionMatrix();
    invalidate();
  }, [bounds, camera, size.width, size.height, invalidate]);
  return null;
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

function FadingGrid() {
  const material = useMemo(() => new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uColor: { value: new Color(colors.hlOk) },
      uCell: { value: 1 },
      uFade: { value: 13 },
      uStrength: { value: 0.22 }
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[48, 48]} />
    </mesh>
  );
}

function ContactShadow() {
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.046, 1.1]} renderOrder={2}>
      <planeGeometry args={[11, 15]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function HouseModel() {
  const gltf = useLoader(GLTFLoader, HOUSE_MODEL_URL);
  const dressed = useMemo(() => dress(gltf.scene), [gltf]);
  useEffect(() => () => { dressed.dispose(); }, [dressed]);
  return (
    <group>
      <primitive object={dressed.scene} />
      <ContactShadow />
      <FitCamera bounds={dressed.bounds} />
    </group>
  );
}

function Scene({ motion, reduced, draw }: { motion: MutableRefObject<Motion>; reduced: boolean; draw: MutableRefObject<() => void> }) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const idleRef = useRef(motion);

  useEffect(() => { draw.current = invalidate; }, [draw, invalidate]);

  useEffect(() => {
    gl.shadowMap.type = PCFSoftShadowMap;
    gl.domElement.tabIndex = -1;
    gl.domElement.setAttribute("aria-hidden", "true");
    gl.domElement.style.touchAction = "none";
    invalidate();
  }, [gl, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    let resume = 0;
    const down = (event: PointerEvent) => {
      resume += 1;
      idleRef.current.current.dragging = true;
      idleRef.current.current.idle = false;
      lastX = event.clientX;
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const current = idleRef.current.current;
      if (!current.dragging) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      current.yaw += dx * 0.01;
      invalidate();
    };
    const up = (event: PointerEvent) => {
      const current = idleRef.current.current;
      if (!current.dragging) return;
      current.dragging = false;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      const token = ++resume;
      window.setTimeout(() => { if (token === resume) current.idle = true; }, 1600);
      invalidate();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, invalidate]);

  useFrame((_, delta) => {
    const current = motion.current;
    if (shouldAutoRotate(reduced, current.idle, current.dragging)) current.yaw += delta * AUTO_YAW_PER_SEC;
    if (group.current) group.current.rotation.y = current.yaw;
  });

  return (
    <>
      <color attach="background" args={[colors.paper]} />
      <hemisphereLight args={[colors.paper, colors.mist, 1.55]} />
      <KeyLight />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color={colors.paper} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.034, 0]} receiveShadow renderOrder={1}>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.28} transparent />
      </mesh>
      <FadingGrid />
      <group ref={group}>
        <HouseModel />
      </group>
    </>
  );
}

useLoader.preload(GLTFLoader, HOUSE_MODEL_URL);

export default function HouseBlueprint({ label }: { label: string }) {
  const motion = useRef<Motion>({ yaw: 0, dragging: false, idle: true });
  const draw = useRef<() => void>(() => {});
  const [reduced, setReduced] = useState(() => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [hidden, setHidden] = useState(false);

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
      className="h-full w-full touch-none"
      onKeyDown={onKey}
    >
      <Canvas
        flat
        frameloop={reduced || hidden ? "demand" : "always"}
        dpr={[1, 2]}
        shadows="soft"
        camera={{ fov: CAMERA_FOV_DEG, position: [-8, 5, 14], near: 0.05, far: 200 }}
        gl={{ antialias: true, powerPreference: "low-power", alpha: false }}
      >
        <Scene motion={motion} reduced={reduced || hidden} draw={draw} />
      </Canvas>
    </div>
  );
}
