import { lazy, Suspense, useEffect, useState } from "react";
import { BlueprintFallback } from "./BlueprintFallback";

const HouseBlueprint = lazy(() => import("./HouseBlueprint"));

export function canUseWebGL(): boolean {
  try {
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return false;
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Loads the 3D chunk only when WebGL exists. The fallback is the first paint. */
export function BlueprintSlot({ label }: { label: string }) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => { setWebgl(canUseWebGL()); }, []);
  if (!webgl) return <BlueprintFallback label={label} />;
  return (
    <Suspense fallback={<BlueprintFallback label={label} />}>
      <HouseBlueprint label={label} />
    </Suspense>
  );
}
