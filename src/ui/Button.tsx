import { useRef, type ButtonHTMLAttributes, type MouseEvent } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  /** Greys the button out, shows a spinner, and ignores taps. */
  loading?: boolean;
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/** Label should be 24 characters or fewer (enforced for i18n keys by the lint). */
export function Button({ variant = "primary", className = "", type = "button", loading = false, disabled, onClick, children, ...rest }: Props) {
  const flight = useRef(false);
  const blocked = Boolean(disabled || loading);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked || flight.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    flight.current = true;
    try {
      const result = onClick?.(event) as unknown;
      const pending = result && typeof (result as Promise<unknown>).then === "function"
        ? (result as Promise<unknown>)
        : Promise.resolve();
      void pending.finally(() => { flight.current = false; });
    } catch (error) {
      flight.current = false;
      throw error;
    }
  };
  const base = "inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-full px-5 font-semibold ";
  const width = loading ? "w-full " : "";
  const look = blocked
    ? "cursor-not-allowed bg-panel text-ink "
    : variant === "primary"
      ? "bg-brand text-paper "
      : "border-2 border-ink bg-transparent text-ink ";
  return (
    <button
      {...rest}
      type={type}
      className={`${base}${width}${look}${className}`}
      disabled={blocked}
      aria-disabled={blocked ? "true" : undefined}
      aria-busy={loading ? "true" : undefined}
      onClick={handleClick}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
