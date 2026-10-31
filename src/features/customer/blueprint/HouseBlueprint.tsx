import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  type Group
} from "three";
import {
  AUTO_YAW_PER_SEC,
  buildSantaSofia,
  clampPitch,
  shouldAutoRotate,
  type BoxPart,
  type RoofSpec
} from "./houseModel";

const LINE = "#1e4b8f";
const FACE: Record<BoxPart["role"] | "roof", { color: string; opacity: number }> = {
  body: { color: "#b7d4f2", opacity: 0.42 },
  band: { color: "#8fb4de", opacity: 0.55 },
  patio: { color: "#c5dff8", opacity: 0.5 },
  garage: { color: "#e7f3fc", opacity: 0.2 },
  door: { color: "#7eaddd", opacity: 0.62 },
  window: { color: "#f4f9fd", opacity: 0.35 },
  roof: { color: "#d5e7f8", opacity: 0.48 }
};

interface Motion {
  yaw: number;
  pitch: number;
  dragging: boolean;
  idle: boolean;
}

function roofGeometry(roof: RoofSpec): BufferGeometry {
  const hw = roof.width / 2;
  const hd = roof.depth / 2;
  const positions = [
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    -hw, roof.frontHeight, -hd, hw, roof.frontHeight, -hd, hw, roof.backHeight, hd, -hw, roof.backHeight, hd
  ];
  const index = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}

function Edged({ geometry, position, color, opacity }: {
  geometry: BufferGeometry;
  position: [number, number, number];
  color: string;
  opacity: number;
}) {
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  useEffect(() => () => { edges.dispose(); }, [edges]);
  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={color} transparent opacity={opacity} side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={LINE} />
      </lineSegments>
    </group>
  );
}

function BoxPartMesh({ part }: { part: BoxPart }) {
  const [w, h, d] = part.size;
  const geometry = useMemo(() => new BoxGeometry(w, h, d), [w, h, d]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  const face = FACE[part.role];
  return <Edged geometry={geometry} position={part.position} color={face.color} opacity={face.opacity} />;
}

function RoofMesh({ roof }: { roof: RoofSpec }) {
  const geometry = useMemo(() => roofGeometry(roof), [roof]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  return <Edged geometry={geometry} position={roof.position} color={FACE.roof.color} opacity={FACE.roof.opacity} />;
}

function Scene({ motion, reduced, draw }: { motion: MutableRefObject<Motion>; reduced: boolean; draw: MutableRefObject<() => void> }) {
  const group = useRef<Group>(null);
  const shell = useMemo(() => buildSantaSofia(), []);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const idleRef = useRef(motion);

  useEffect(() => { draw.current = invalidate; }, [draw, invalidate]);

  useEffect(() => {
    camera.lookAt(0, 2.6, -1.4);
    gl.domElement.tabIndex = -1;
    gl.domElement.setAttribute("aria-hidden", "true");
    gl.domElement.style.touchAction = "none";
    invalidate();
  }, [camera, gl, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    let lastY = 0;
    let resume = 0;
    const down = (event: PointerEvent) => {
      resume += 1;
      idleRef.current.current.dragging = true;
      idleRef.current.current.idle = false;
      lastX = event.clientX;
      lastY = event.clientY;
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const current = idleRef.current.current;
      if (!current.dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      current.yaw += dx * 0.01;
      current.pitch = clampPitch(current.pitch + dy * 0.005);
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
    group.current.rotation.x = current.pitch;
  });

  return (
    <>
      <color attach="background" args={["#f7fafc"]} />
      <gridHelper args={[16, 16, "#c5d4e6", "#e7eef6"]} />
      <group ref={group}>
        {shell.parts.map((part) => <BoxPartMesh key={part.id} part={part} />)}
        <RoofMesh roof={shell.roof} />
      </group>
    </>
  );
}

export default function HouseBlueprint({ label }: { label: string }) {
  const motion = useRef<Motion>({ yaw: 0.15, pitch: 0.18, dragging: false, idle: true });
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
    else if (event.key === "ArrowUp") current.pitch = clampPitch(current.pitch - 0.08);
    else if (event.key === "ArrowDown") current.pitch = clampPitch(current.pitch + 0.08);
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
        frameloop={reduced || hidden ? "demand" : "always"}
        dpr={[1, 1.5]}
        camera={{ position: [13, 8.5, -15.5], fov: 34 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <Scene motion={motion} reduced={reduced || hidden} draw={draw} />
      </Canvas>
    </div>
  );
}
