declare global {
  interface Window {
    desktop?: {
      platform: string;
      isElectron: boolean;
      setTheme?: (mode: "system" | "light" | "dark") => void;
    };
  }
}

export const appPlatform = "windows" as const;
export const shortcutModifier = "Ctrl";
