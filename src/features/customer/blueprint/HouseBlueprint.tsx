import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  EdgesGeometry,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Vector3,
  type Group
} from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { colors } from "@/ui/tokens";
import { AUTO_YAW_PER_SEC, buildSantaSofia, shouldAutoRotate, type BoxPart, type EdgeRank } from "./houseModel";

interface Motion {
  yaw: number;
  dragging: boolean;
  idle: boolean;
}

const FACE = colors.panel;
const CLEAR = colors.paper;

function edgePositions(parts: readonly BoxPart[], rank: EdgeRank): Float32Array {
  const values: number[] = [];
  for (const part of parts) {
    if (part.rank !== rank) continue;
    const geometry = new BoxGeometry(...part.size);
    geometry.translate(...part.position);
    const edges = new EdgesGeometry(geometry, 12);
    const array = edges.getAttribute("position").array;
    for (let i = 0; i < array.length; i += 1) values.push(array[i] ?? 0);
    edges.dispose();
    geometry.dispose();
  }
  return new Float32Array(values);
}

function FatEdges({ positions, color, width }: { positions: Float32Array; color: string; width: number }) {
  const { size, viewport } = useThree();
  const line = useMemo(() => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(Array.from(positions));
    const material = new LineMaterial({ color, linewidth: width, worldUnits: false, transparent: true, opacity: 1 });
    const object = new LineSegments2(geometry, material);
    object.computeLineDistances();
    return object;
  }, [positions, color, width]);

  useLayoutEffect(() => {
    const material = line.material as LineMaterial;
    material.resolution.set(size.width * viewport.dpr, size.height * viewport.dpr);
  }, [line, size.width, size.height, viewport.dpr]);

  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as LineMaterial).dispose();
  }, [line]);

  return <primitive object={line} />;
}

function Volumes({ parts }: { parts: readonly BoxPart[] }) {
  const mesh = useMemo(() => {
    const material = new MeshLambertMaterial({
      color: FACE,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide
    });
    const groupParts = parts.map((part) => {
      const geometry = new BoxGeometry(...part.size);
      const item = new Mesh(geometry, material);
      item.position.set(...part.position);
      item.renderOrder = 1;
      return item;
    });
    return { material, groupParts };
  }, [parts]);

  useEffect(() => () => {
    mesh.material.dispose();
    mesh.groupParts.forEach((item) => item.geometry.dispose());
  }, [mesh]);

  return (
    <group>
      {mesh.groupParts.map((item, index) => <primitive key={parts[index]?.id ?? index} object={item} />)}
    </group>
  );
}

function contactTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const fade = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    fade.addColorStop(0, "rgba(46,46,46,0.28)");
    fade.addColorStop(0.55, "rgba(46,46,46,0.1)");
    fade.addColorStop(1, "rgba(46,46,46,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function Ground({ groundY, radius }: { groundY: number; radius: number }) {
  const texture = useMemo(() => contactTexture(), []);
  useEffect(() => () => { texture.dispose(); }, [texture]);
  const span = radius * 2.4;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY + 0.02, 0]}>
      <planeGeometry args={[span, span]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function FadeGrid({ groundY, radius }: { groundY: number; radius: number }) {
  const material = useMemo(() => {
    const hex = colors.line.replace("#", "");
    const n = parseInt(hex, 16);
    return {
      uniforms: {
        uColor: { value: new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) }
      }
    };
  }, []);
  const span = radius * 3.2;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY + 0.01, 0]} renderOrder={0}>
      <planeGeometry args={[span, span]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={material.uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform vec3 uColor;
          void main() {
            vec2 grid = abs(fract(vUv * 28.0 - 0.5) - 0.5);
            float line = min(grid.x, grid.y);
            float width = fwidth(line) * 1.4;
            float mask = 1.0 - smoothstep(0.0, width, line);
            vec2 centered = vUv * 2.0 - 1.0;
            float fade = 1.0 - smoothstep(0.28, 0.98, length(centered));
            float alpha = mask * fade * 0.55;
            if (alpha < 0.02) discard;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

function Frame({ radius }: { radius: number }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.06;
    const elevation = 0.42;
    const azimuth = Math.PI - 0.68;
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * dist,
      Math.sin(elevation) * dist,
      Math.cos(azimuth) * Math.cos(elevation) * dist
    );
    camera.near = Math.max(dist / 100, 0.05);
    camera.far = dist * 24;
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, radius, size.width, size.height]);
  return null;
}

function Scene({ motion, reduced, draw }: { motion: MutableRefObject<Motion>; reduced: boolean; draw: MutableRefObject<() => void> }) {
  const group = useRef<Group>(null);
  const shell = useMemo(() => buildSantaSofia(), []);
  const primary = useMemo(() => edgePositions(shell.parts, "primary"), [shell]);
  const secondary = useMemo(() => edgePositions(shell.parts, "secondary"), [shell]);
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const idleRef = useRef(motion);

  useEffect(() => { draw.current = invalidate; }, [draw, invalidate]);

  useEffect(() => {
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
      current.yaw += dx * 0.008;
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
    if (!group.current) return;
    group.current.rotation.y = current.yaw;
  });

  return (
    <>
      <color attach="background" args={[CLEAR]} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[5, 9, -7]} intensity={0.62} />
      <directionalLight position={[-4, 5, 6]} intensity={0.22} />
      <Frame radius={shell.radius} />
      <FadeGrid groundY={shell.groundY} radius={shell.radius} />
      <group ref={group}>
        <Ground groundY={shell.groundY} radius={shell.radius} />
        <Volumes parts={shell.parts} />
        <FatEdges positions={primary} color={colors.ink} width={1.65} />
        <FatEdges positions={secondary} color={colors.inkSoft} width={0.9} />
      </group>
    </>
  );
}

export default function HouseBlueprint({ label }: { label: string }) {
  const motion = useRef<Motion>({ yaw: 0.55, dragging: false, idle: true });
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
      className="h-full w-full touch-none bg-paper"
      onKeyDown={onKey}
    >
      <Canvas
        frameloop={reduced || hidden ? "demand" : "always"}
        dpr={[1, 2]}
        camera={{ position: [8, 5, -10], fov: 34 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      >
        <Scene motion={motion} reduced={reduced || hidden} draw={draw} />
      </Canvas>
    </div>
  );
}
