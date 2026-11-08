import { useEffect, useState, type ReactNode } from "react";
import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";
export function PlatformProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === "dark");
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.dataset.theme === "dark")
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  const theme: Theme = {
    ...(dark ? webDarkTheme : webLightTheme),

    fontFamilyBase: '"Segoe UI Variable", "Segoe UI", sans-serif',
    fontFamilyNumeric: '"Segoe UI Variable", "Segoe UI", sans-serif',
    borderRadiusSmall: "4px",
    borderRadiusMedium: "4px",
    borderRadiusLarge: "8px",
    borderRadiusXLarge: "8px",
    colorBrandBackground: "var(--app-accent)",
    colorBrandBackgroundHover: "var(--app-accent-hover)",
    colorBrandBackgroundPressed: "var(--app-accent-pressed)",
    colorBrandForeground1: "var(--app-accent)",
    colorNeutralForegroundOnBrand: "var(--app-accent-foreground)",
    colorCompoundBrandBackground: "var(--app-accent)",
    colorCompoundBrandStroke: "var(--app-accent)",
  };
  return (
    <FluentProvider theme={theme} className="platform-provider">
      {children}
    </FluentProvider>
  );
}
