import type { Log } from "../types";
import { localDate } from "../utils/dates";
export function computePlayHabits(logs: Log[], now = new Date()) {
  const todayKey = localDate(now);
  const dayNumber = (date: string) => Date.parse(date + "T00:00:00Z") / 86400000;
  const today = dayNumber(todayKey);
  const days = new Set(
    logs
      .flatMap((log) => (log.playSessions ?? []).map((session) => session.date))
      .filter(
        (date) =>
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Number.isFinite(dayNumber(date)) &&
          dayNumber(date) <= today
      )
  );
  const sorted = [...days].sort();
  let longest = 0;
  let streak = 0;
  let previous = -Infinity;
  for (const date of sorted) {
    const day = dayNumber(date);
    streak = day - previous === 1 ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = day;
  }
  const current = today - previous <= 1 ? streak : 0;
  const heatmap = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (364 - index));
    const key = localDate(date);
    return { date: key, played: days.has(key) };
  });
  return { maxStreak: longest, currentStreak: current, heatmapData: heatmap };
}
