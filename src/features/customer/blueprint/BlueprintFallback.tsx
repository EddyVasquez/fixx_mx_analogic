import { HOUSE_FALLBACK_URL } from "./houseModel";

/** Static render of the house, shown before the 3D chunk loads and when WebGL is missing. */
export function BlueprintFallback({ label }: { label: string }) {
  return (
    <img
      src={HOUSE_FALLBACK_URL}
      alt={label}
      draggable={false}
      data-blueprint="fallback"
      className="h-full w-full bg-white object-contain"
    />
  );
}
