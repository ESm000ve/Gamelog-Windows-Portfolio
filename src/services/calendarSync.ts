import type { Game, Log } from "../types";
import { gameStatusLabel } from "./gameStatus";

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function generateCalendarICS(
  entries: { game: Game; log?: Log }[],
  calendarName: string = "Game Library Dates"
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Gamelog//${calendarName.replace(/[^a-zA-Z0-9 ]/g, "")}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const { game, log } of entries) {
    const start =
      log?.startedAt && /^\d{4}-\d{2}-\d{2}$/.test(log.startedAt)
        ? new Date(log.startedAt + "T00:00:00Z")
        : null;
    const validStart =
      start &&
      Number.isFinite(start.getTime()) &&
      start.toISOString().slice(0, 10) === log?.startedAt;
    const release = game.firstReleaseDate ? new Date(game.firstReleaseDate * 1000) : null;
    const validRelease =
      release &&
      Number.isFinite(release.getTime()) &&
      release.getUTCFullYear() >= 1000 &&
      release.getUTCFullYear() <= 9999;
    const validYear =
      Number.isInteger(game.releaseYear) && game.releaseYear >= 1000 && game.releaseYear <= 9999;
    if (!validStart && !validRelease && !validYear) continue;
    const date = validStart
      ? start!
      : validRelease
        ? release!
        : new Date(Date.UTC(game.releaseYear, 6, 1));
    const dateSource = validStart
      ? "Recorded start date"
      : validRelease
        ? "Release date"
        : "Release year estimate (July 1)";
    const year = date.getUTCFullYear();
    const dtStart = date.toISOString().slice(0, 10).replace(/-/g, "");
    const endDate = new Date(date.getTime() + 86400000);
    const dtEnd = endDate.toISOString().slice(0, 10).replace(/-/g, "");
    // Keep event identities stable for previously imported calendar files.
    const uid = `game-${game.igdbId}-${year}@buildlibraryscreen.local`;
    const status = log ? gameStatusLabel(log.status, log.completion) : "Library";
    const summary = `🎮 ${game.title} (${status})`;
    const platforms = log?.platforms?.length
      ? log.platforms.join(", ")
      : log?.platform || "Not recorded";
    const description = `Game: ${game.title}\nStatus: ${status}\nRating: ${log?.rating ? `${log.rating}/5` : "Unrated"}\nPlatform: ${platforms}\nDate: ${dateSource}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadCalendarICS(
  entries: { game: Game; log?: Log }[],
  filename: string = "game-library.ics",
  calendarName?: string
): void {
  const content = generateCalendarICS(entries, calendarName);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
