import { Surface } from "../../components/ui/PageLayout";
import { RadioGroup, Radio } from "@fluentui/react-components";
import { Button } from "../../components/ui/Button";
import { Palette, Check } from "../../components/icons";
import { ACCENT_OPTIONS, type ThemeMode, type AccentColor } from "../../services/theme";
import "./Settings.css";

interface ThemeSettingsProps {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  onThemeModeChange: (mode: ThemeMode) => void;
  onAccentColorChange: (color: AccentColor) => void;
}

const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "system", label: "System" },
];

export function ThemeSettings({
  themeMode,
  accentColor,
  onThemeModeChange,
  onAccentColorChange,
}: ThemeSettingsProps) {
  return (
    <Surface className="settings-card">
      <div className="settings-card-header">
        <Palette size={24} color="var(--app-accent)" />
        <h2>Appearance</h2>
      </div>

      <p className="settings-card-description">
        Personalize your library&apos;s look and feel by choosing an accent color and selecting your
        preferred color theme.
      </p>

      {/* Accent color Swatches */}
      <div>
        <div className="settings-field-label">Accent color</div>
        <div className="settings-accent-grid">
          {ACCENT_OPTIONS.map((opt) => {
            const isSelected = accentColor === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                onClick={() => onAccentColorChange(opt.id)}
                aria-label={`Select ${opt.name} accent`}
                aria-pressed={isSelected}
                className={`settings-accent-swatch ${isSelected ? "selected" : ""}`}
                style={{
                  background: isSelected
                    ? `color-mix(in srgb, ${opt.hex} 12%, transparent)`
                    : undefined,
                  border: isSelected ? `2px solid ${opt.hex}` : undefined,
                  color: isSelected ? opt.hex : undefined,
                }}
              >
                <span className="settings-accent-swatch-dot" style={{ background: opt.hex }} />
                {opt.name}
                {isSelected && (
                  <Check size={12} aria-hidden="true" style={{ marginLeft: "auto" }} />
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Theme Mode Toggle */}
      <div>
        <div className="settings-field-label">Color theme</div>
        {
          <RadioGroup
            aria-label="Color theme"
            layout="horizontal"
            value={themeMode}
            onChange={(_event, data) => onThemeModeChange(data.value as ThemeMode)}
          >
            {THEME_MODES.map(({ key, label }) => (
              <Radio key={key} value={key} label={label} />
            ))}
          </RadioGroup>
        }
      </div>
    </Surface>
  );
}
