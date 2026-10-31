import { useId } from "react";

const INK = "#2E2E2E";
const SOFT = "#484848";
const FACE = "#D4D4D4";
const LINE = "#C8C8C8";
const PAPER = "#FFFFFF";

/** Static front elevation used before the 3D chunk loads, and when WebGL is missing. */
export function BlueprintFallback({ label }: { label: string }) {
  const gridId = `bp${useId().replace(/:/g, "")}`;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 360 240" className="h-full w-full bg-paper" data-blueprint="fallback">
      <defs>
        <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke={LINE} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="360" height="240" fill={PAPER} />
      <rect width="360" height="240" fill={`url(#${gridId})`} />
      <rect x="70" y="78" width="220" height="8" fill={FACE} fillOpacity="0.7" stroke={INK} strokeWidth="1.75" />
      <rect x="86" y="86" width="188" height="112" fill={FACE} fillOpacity="0.45" stroke={INK} strokeWidth="1.75" />
      <line x1="82" y1="142" x2="278" y2="142" stroke={INK} strokeWidth="1.75" />
      <rect x="98" y="168" width="78" height="30" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <path d="M102 174 H172 M102 182 H172 M102 190 H172 M140 168 V198" fill="none" stroke={SOFT} strokeWidth="1" />
      <rect x="196" y="164" width="40" height="34" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <line x1="196" y1="181" x2="236" y2="181" stroke={SOFT} strokeWidth="1" />
      <path d="M190 160 H242 L236 154 H196 Z" fill={FACE} fillOpacity="0.8" stroke={INK} strokeWidth="1.5" />
      <rect x="108" y="100" width="34" height="26" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <path d="M125 100 V126 M108 113 H142" fill="none" stroke={SOFT} strokeWidth="1" />
      <rect x="163" y="100" width="34" height="26" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <path d="M180 100 V126 M163 113 H197" fill="none" stroke={SOFT} strokeWidth="1" />
      <rect x="218" y="100" width="34" height="26" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <path d="M235 100 V126 M218 113 H252" fill="none" stroke={SOFT} strokeWidth="1" />
      <line x1="100" y1="128" x2="150" y2="128" stroke={INK} strokeWidth="1.25" />
      <line x1="155" y1="128" x2="205" y2="128" stroke={INK} strokeWidth="1.25" />
      <line x1="210" y1="128" x2="260" y2="128" stroke={INK} strokeWidth="1.25" />
      <rect x="188" y="198" width="56" height="6" fill={FACE} stroke={INK} strokeWidth="1.25" />
      <rect x="182" y="204" width="68" height="6" fill={FACE} stroke={SOFT} strokeWidth="1" />
    </svg>
  );
}
