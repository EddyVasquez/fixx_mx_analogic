import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

/** Label should be 24 characters or fewer (enforced for i18n keys by the lint). */
export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  const base = "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full px-5 font-semibold ";
  const look = variant === "primary" ? "bg-brand text-paper" : "border-2 border-ink bg-transparent text-ink";
  return <button type={type} className={`${base}${look} ${className}`} {...rest} />;
}
