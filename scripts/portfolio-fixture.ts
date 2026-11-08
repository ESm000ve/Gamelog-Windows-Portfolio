import type { Game, Log, UserList } from "../src/types/index.ts";

// Fictional titles, original geometric cover art and invented play records.
// This fixture is imported only by the screenshot script, never by the app.
const titles = [
  "SOLSTICE",
  "TIDELANDS",
  "AFTER HOURS",
  "ORBITAL",
  "WILDFLOWER",
  "THE LONG WAY",
  "MONUMENT",
  "STILLWATER",
  "NEON DRIFT",
  "SABLE SKY",
  "PAPER MOON",
  "NORTHBOUND",
];
const colors = [
  ["#eeb76d", "#67373c"],
  ["#7cd4d0", "#163e55"],
  ["#f998b5", "#42234b"],
  ["#8baff5", "#18274d"],
  ["#ceda8c", "#335b45"],
  ["#e39568", "#643743"],
];
const now = new Date("2026-11-08T12:00:00Z").getTime();
function cover(title: string, index: number) {
  const [light, dark] = colors[index % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><defs><linearGradient id="g" x2="0.7" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="360" height="480" fill="url(#g)"/><circle cx="${110 + (index % 3) * 60}" cy="185" r="90" fill="${light}" opacity=".65"/><circle cx="${140 + (index % 2) * 80}" cy="195" r="64" fill="${dark}" opacity=".6"/><path d="M-20 360 160 190 390 400V480H0Z" fill="${dark}" opacity=".7"/><path d="M-20 410 250 220 390 400V480H0Z" fill="${dark}" opacity=".65"/><text x="28" y="42" fill="white" opacity=".8" font-family="sans-serif" font-size="11" letter-spacing="4">GAMELOG ORIGINALS</text><text x="28" y="407" fill="white" font-family="sans-serif" font-size="${title.length > 10 ? 25 : 32}" font-weight="700" letter-spacing="2">${title}</text><text x="30" y="437" fill="white" opacity=".65" font-family="sans-serif" font-size="10" letter-spacing="3">A FICTIONAL ADVENTURE</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
const games: Game[] = titles.map((title, i) => ({
  igdbId: 990001 + i,
  title: title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  slug: `portfolio-${i}`,
  developer: "Fictional Studio",
  releaseYear: 2020 + (i % 6),
  firstReleaseDate: 1609459200 + i * 86400,
  summary:
    "A fictional game created to demonstrate Gamelog’s library and journal. All catalog details and play records in this sample are illustrative.",
  genres: [
    ["Adventure", "Role-playing (RPG)"],
    ["Puzzle", "Adventure"],
    ["Indie", "Simulator"],
    ["Adventure", "Shooter"],
  ][i % 4],
  platforms: i % 2 ? ["PC", "Nintendo Switch"] : ["PC"],
  coverUrl: cover(title, i),
  coverColor: colors[i % colors.length][1],
  timeToBeat: { finish: 4 + i * 2, master: 12 + i * 3 },
  addedAt: now - i * 86400000,
  updatedAt: now,
}));
const logs: Log[] = games.map((game, i) => ({
  igdbId: game.igdbId,
  status: i < 3 ? "Playing" : i < 7 ? "Backlog" : i < 11 ? "Played" : "Wishlist",
  ...(i >= 7 && i < 11
    ? { completion: "Completed" as const, finishedAt: `2026-10-${12 + i}`, rating: i % 2 ? 4.5 : 4 }
    : {}),
  ...(i < 3 ? { rating: 4.5 } : {}),
  platform: "PC",
  ownership: ["Digital"],
  timePlayed: i < 3 ? 4 + i * 3 : i >= 7 && i < 11 ? 12 + i : 0,
  notes: i < 3 ? "Take the scenic route next time. There is still a lot left to explore." : "",
  playSessions:
    i < 3 || (i >= 7 && i < 11)
      ? Array.from({ length: 5 }, (_, d) => ({
          date: `2026-11-${String(1 + ((i + d) % 7)).padStart(2, "0")}`,
          durationMinutes: 30 + i * 10,
        }))
      : [],
  createdAt: game.addedAt,
  updatedAt: now,
}));
const lists: UserList[] = [
  {
    id: "weekend-escapes",
    name: "Weekend escapes",
    isRanked: false,
    gameIds: games.slice(0, 6).map((g) => g.igdbId),
    createdAt: now,
    updatedAt: now,
  },
];
export const portfolioFixture = {
  version: 2,
  exported: new Date(now).toISOString(),
  games,
  logs,
  lists,
  tags: [],
};
