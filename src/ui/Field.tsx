import { forwardRef, type ReactNode } from "react";

export const inputClass = "min-h-touch w-full rounded-lg border-2 border-ink bg-paper px-3 text-base font-normal text-ink";
export const focusTargetClass = "outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink";

export function Field({ label, hint, hintId, children }: { label: string; hint?: string; hintId?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 font-semibold">
      {label}
      {children}
      {hint && <span id={hintId} className="text-sm font-normal text-inkSoft">{hint}</span>}
    </label>
  );
}

export const ErrorText = forwardRef<HTMLParagraphElement, { children: ReactNode; id?: string }>(function ErrorText({ children, id }, ref) {
  return (
    <p ref={ref} id={id} role="alert" tabIndex={-1} className={`rounded-lg border-2 border-ink bg-paper p-2 text-sm font-bold ${focusTargetClass}`}>
      {children}
    </p>
  );
});
