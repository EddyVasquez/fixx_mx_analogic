import type { ReactNode } from "react";

/** Work-order highlights. Meaning is carried by shape and lightness, and always sits on text that names it. */
export const Label = ({ children }: { children: ReactNode }) => <span className="rounded bg-label px-2 py-0.5 text-sm font-bold text-paper">{children}</span>;
export const HlAmount = ({ children }: { children: ReactNode }) => <span className="rounded bg-paper px-2 py-0.5 font-bold text-ink">{children}</span>;
export const HlOk = ({ children }: { children: ReactNode }) => <span className="rounded bg-hlOk px-2 py-0.5 font-bold text-ink">{children}</span>;
export const HlDate = ({ children }: { children: ReactNode }) => <span className="rounded px-2 py-0.5 font-bold text-ink ring-2 ring-ink">{children}</span>;
