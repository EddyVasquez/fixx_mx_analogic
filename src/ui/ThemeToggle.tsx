import { Moon } from "@phosphor-icons/react/Moon";
import { Sun } from "@phosphor-icons/react/Sun";
import { useTranslation } from "react-i18next";
import { toggleTheme, useTheme } from "./theme";

/** Sun or moon, 44px hit area. Sits on the My Home hero and switches the whole app. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dark = theme === "dark";
  const label = dark ? t("theme.useLight") : t("theme.useDark");
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      className="theme-toggle inline-flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
      aria-label={label}
      aria-pressed={dark}
      onClick={toggleTheme}
    >
      <Icon aria-hidden="true" size={22} weight="bold" color="currentColor" />
    </button>
  );
}
