import { AISettings } from "./AISettings";
import { PageHeader } from "../../components/ui/PageLayout";
import { RecoverySettings } from "./RecoverySettings";
import { useState } from "react";
import {
  getStoredThemeMode,
  setStoredThemeMode,
  getStoredAccentColor,
  setStoredAccentColor,
  type ThemeMode,
  type AccentColor,
} from "../../services/theme";
import { ThemeSettings } from "./ThemeSettings";
import { BackupSettings } from "./BackupSettings";
import { ImportSettings } from "./ImportSettings";

export function SettingsScreen() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => getStoredAccentColor());

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeModeState(mode);
    setStoredThemeMode(mode);
  };

  const handleAccentColorChange = (color: AccentColor) => {
    setAccentColorState(color);
    setStoredAccentColor(color);
  };

  return (
    <main id="main-content" className="settings-screen">
      <PageHeader title="Settings" embedded />

      <ThemeSettings
        themeMode={themeMode}
        accentColor={accentColor}
        onThemeModeChange={handleThemeModeChange}
        onAccentColorChange={handleAccentColorChange}
      />

      <AISettings />
      <BackupSettings />

      <ImportSettings />
      <RecoverySettings />
    </main>
  );
}
