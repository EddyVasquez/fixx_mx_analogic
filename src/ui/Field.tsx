import type { ReactNode } from "react";

export const inputClass = "min-h-touch w-full rounded-lg border-2 border-ink bg-paper px-3 text-base font-normal text-ink";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 font-semibold">
      {label}
      {children}
      {hint && <span className="text-sm font-normal text-inkSoft">{hint}</span>}
    </label>
  );
}
export function ErrorText({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg border-2 border-ink bg-paper p-2 text-sm font-bold">{children}</p>;
}
