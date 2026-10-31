import { useId } from "react";

/** Static front elevation used before the 3D chunk loads, and when WebGL is missing. */
export function BlueprintFallback({ label }: { label: string }) {
  const gridId = `bp${useId().replace(/:/g, "")}`;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 360 240" className="h-full w-full" data-blueprint="fallback">
      <defs>
        <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#d5e0ee" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="360" height="240" fill="#f7fafc" />
      <rect width="360" height="240" fill={`url(#${gridId})`} />
      <polygon points="64,92 296,68 296,92 64,92" fill="#b7d4f2" fillOpacity="0.55" stroke="#1e4b8f" strokeWidth="2" />
      <rect x="78" y="92" width="204" height="118" fill="#b7d4f2" fillOpacity="0.4" stroke="#1e4b8f" strokeWidth="2" />
      <line x1="78" y1="150" x2="282" y2="150" stroke="#1e4b8f" strokeWidth="1.5" />
      <rect x="96" y="158" width="72" height="52" fill="#e7f2fb" fillOpacity="0.35" stroke="#1e4b8f" strokeWidth="2" />
      <rect x="196" y="156" width="42" height="54" fill="#8fb6e0" fillOpacity="0.45" stroke="#1e4b8f" strokeWidth="2" />
      <rect x="98" y="108" width="36" height="28" fill="#e7f2fb" fillOpacity="0.5" stroke="#1e4b8f" strokeWidth="2" />
      <rect x="162" y="108" width="36" height="28" fill="#e7f2fb" fillOpacity="0.5" stroke="#1e4b8f" strokeWidth="2" />
      <rect x="226" y="108" width="36" height="28" fill="#e7f2fb" fillOpacity="0.5" stroke="#1e4b8f" strokeWidth="2" />
    </svg>
  );
}
