import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { config } from "@/core/config/fixx.config";

export type Role = "customer" | "professional" | "admin" | "support";
export const ROLES: readonly Role[] = ["customer", "professional", "admin", "support"];

const Ctx = createContext<{ role: Role; setRole: (r: Role) => void }>({ role: "customer", setRole: () => {} });
export const useRole = () => useContext(Ctx);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("customer");
  const { i18n } = useTranslation();
  // Admin and Support are English and Spanish only: leave Korean automatically when switching to them.
  useEffect(() => {
    if ((role === "admin" || role === "support") && !(config.adminLanguages as readonly string[]).includes(i18n.language)) void i18n.changeLanguage("en");
  }, [role, i18n.language, i18n]);
  const value = useMemo(() => ({ role, setRole }), [role]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
