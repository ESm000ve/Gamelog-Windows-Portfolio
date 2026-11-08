import { platformKey } from "./filterEngine";
import { buildActivityEvents, isPlayEvent } from "./activity";
import type { Game, Log } from "../types";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "Collection" | "Exploration" | "Completion" | "Dedication";
  iconName: string;
  target: number;
}

export interface AchievementStatus extends Achievement {
  current: number;
  unlocked: boolean;
  percentage: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_step",
    title: "First Step",
    description: "Log your very first game in your library",
    category: "Collection",
    iconName: "Gamepad2",
    target: 1,
  },
  {
    id: "curator",
    title: "Library Curator",
    description: "Build a collection of 25 games in your tracker",
    category: "Collection",
    iconName: "Library",
    target: 25,
  },
  {
    id: "rpg_scholar",
    title: "RPG Scholar",
    description: "Play or complete 5 RPG games",
    category: "Exploration",
    iconName: "Sword",
    target: 5,
  },
  {
    id: "genre_explorer",
    title: "Genre Explorer",
    description: "Play games across 8 unique genres",
    category: "Exploration",
    iconName: "Compass",
    target: 8,
  },
  {
    id: "platform_polyglot",
    title: "Platform Polyglot",
    description: "Log games across 4 different gaming platforms",
    category: "Exploration",
    iconName: "Monitor",
    target: 4,
  },
  {
    id: "critical_eye",
    title: "Critical Eye",
    description: "Rate 10 games in your collection",
    category: "Dedication",
    iconName: "Star",
    target: 10,
  },
  {
    id: "master_reviewer",
    title: "Master Reviewer",
    description: "Rate 50 games in your collection",
    category: "Dedication",
    iconName: "Award",
    target: 50,
  },
  {
    id: "time_invested",
    title: "Time Invested",
    description: "Log 50 total hours of gameplay across all titles",
    category: "Dedication",
    iconName: "Clock",
    target: 50,
  },
  {
    id: "hundred_club",
    title: "The Hundred Club",
    description: "Log 100 total hours of gameplay",
    category: "Dedication",
    iconName: "Flame",
    target: 100,
  },
  {
    id: "backlog_conqueror",
    title: "Backlog Conqueror",
    description: "Complete 5 games to shrink your backlog",
    category: "Completion",
    iconName: "CheckCircle2",
    target: 5,
  },
  {
    id: "perfectionist",
    title: "Perfectionist",
    description: "Reach 100% completion on 3 different games",
    category: "Completion",
    iconName: "Trophy",
    target: 3,
  },
  {
    id: "on_a_roll",
    title: "On a Roll",
    description: "Log gameplay activity across 5 distinct calendar days",
    category: "Dedication",
    iconName: "Zap",
    target: 5,
  },
];

export function evaluateAchievements(
  games: Game[],
  logs: Log[],
  now = new Date()
): AchievementStatus[] {
  const gameMap = new Map<number, Game>();
  games.forEach((g) => gameMap.set(g.igdbId, g));

  const validLogs = logs.filter((log) => gameMap.has(log.igdbId));
  const totalGames = validLogs.length;
  let rpgCount = 0,
    ratedCount = 0,
    totalHours = 0,
    completedCount = 0,
    perfectionistCount = 0;
  const uniqueGenres = new Set<string>(),
    uniquePlatforms = new Set<string>();
  const events = buildActivityEvents(games, validLogs, now);
  const playEvents = events.filter(isPlayEvent);
  const activeDays = new Set(playEvents.map((event) => event.date));
  const activeGames = new Set(playEvents.map((event) => event.game.igdbId));
  const sessionHours = new Map<number, number>();
  for (const event of playEvents)
    if (event.type === "session")
      sessionHours.set(
        event.game.igdbId,
        (sessionHours.get(event.game.igdbId) ?? 0) + (event.minutes ?? 0) / 60
      );
  for (const log of validLogs) {
    const game = gameMap.get(log.igdbId)!;
    const played =
      log.status === "Played" ||
      log.status === "Playing" ||
      (typeof log.timePlayed === "number" &&
        Number.isFinite(log.timePlayed) &&
        log.timePlayed > 0) ||
      activeGames.has(game.igdbId);
    if (played) {
      game.genres.forEach((genre) => uniqueGenres.add(genre.toLowerCase()));
      if (
        game.genres.some(
          (genre) => genre.toLowerCase().includes("role-playing") || genre.toLowerCase() === "rpg"
        )
      )
        rpgCount++;
    }
    for (const platform of log.platforms?.length
      ? log.platforms
      : log.platform
        ? [log.platform]
        : [])
      if (platform.trim()) uniquePlatforms.add(platformKey(platform));
    if (
      typeof log.rating === "number" &&
      Number.isFinite(log.rating) &&
      log.rating >= 0.5 &&
      log.rating <= 5 &&
      Number.isInteger(log.rating * 2)
    )
      ratedCount++;
    // Lifetime totals and dated session totals are separate, never additive.
    if (
      typeof log.timePlayed === "number" &&
      Number.isFinite(log.timePlayed) &&
      log.timePlayed >= 0
    )
      totalHours += log.timePlayed;
    else totalHours += sessionHours.get(game.igdbId) ?? 0;
    if (
      log.status === "Played" &&
      (log.completion === "Completed" || log.completion === "Mastered")
    )
      completedCount++;
    if (
      log.status === "Played" &&
      (log.completion === "Mastered" || log.completionPercentage === 100)
    )
      perfectionistCount++;
  }

  return ACHIEVEMENTS.map((ach) => {
    let current = 0;
    switch (ach.id) {
      case "first_step":
        current = totalGames;
        break;
      case "curator":
        current = totalGames;
        break;
      case "rpg_scholar":
        current = rpgCount;
        break;
      case "genre_explorer":
        current = uniqueGenres.size;
        break;
      case "platform_polyglot":
        current = uniquePlatforms.size;
        break;
      case "critical_eye":
        current = ratedCount;
        break;
      case "master_reviewer":
        current = ratedCount;
        break;
      case "time_invested":
        current = Math.floor(totalHours);
        break;
      case "hundred_club":
        current = Math.floor(totalHours);
        break;
      case "backlog_conqueror":
        current = completedCount;
        break;
      case "perfectionist":
        current = perfectionistCount;
        break;
      case "on_a_roll":
        current = activeDays.size;
        break;
      default:
        current = 0;
    }

    const percentage = Math.min(100, Math.round((current / ach.target) * 100));
    const unlocked = current >= ach.target;

    return {
      ...ach,
      current: Math.min(current, ach.target),
      unlocked,
      percentage,
    };
  });
}
