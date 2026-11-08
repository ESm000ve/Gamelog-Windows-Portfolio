// Expanded type names are stable across IGDB's enum-to-table migration.
// Table IDs are deliberately not interpreted as the retired category enum.
export function relatedCategory(game: {
  category?: number;
  game_type?: { id?: number; type?: string };
}) {
  const type = game.game_type?.type;
  if (type) {
    const key = type.toLowerCase().replace(/[^a-z]/g, "");
    const categories: Record<string, number> = {
      maingame: 0,
      fullgame: 0,
      dlcaddon: 1,
      dlc: 1,
      expansion: 2,
      bundle: 3,
      standaloneexpansion: 4,
      mod: 5,
      episode: 6,
      season: 7,
      remake: 8,
      remaster: 9,
      expandedgame: 10,
      expandededition: 10,
      port: 11,
      fork: 12,
      pack: 13,
      update: 14,
    };
    return categories[key];
  }
  return game.category;
}
