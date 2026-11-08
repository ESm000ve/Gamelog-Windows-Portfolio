export const PLATFORM_ABBREVIATIONS: Record<string, string> = {
  "PlayStation 5": "PS5",
  "PlayStation 4": "PS4",
  "PlayStation 3": "PS3",
  "PlayStation 2": "PS2",
  PlayStation: "PS1",
  "Nintendo Switch": "Switch",
  "Xbox Series X|S": "Xbox Series",
  "Xbox One": "Xbox One",
  "Xbox 360": "Xbox 360",
  "Super Nintendo Entertainment System (SNES)": "SNES",
  "Super Nintendo Entertainment System": "SNES",
  "Nintendo Entertainment System (NES)": "NES",
  "Nintendo Entertainment System": "NES",
  "Nintendo 64": "N64",
  "Nintendo GameCube": "NGC",
  "Nintendo 3DS": "3DS",
  "Sega Mega Drive/Genesis": "Genesis",
  "PC (Microsoft Windows)": "PC",
};

export function shortPlatform(p?: string) {
  if (!p) return "";
  return PLATFORM_ABBREVIATIONS[p] || p;
}
