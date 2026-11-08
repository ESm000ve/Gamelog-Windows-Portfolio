import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMarkdownList, copyCanvasImageToClipboard } from "../src/services/listShare";
import { generateCalendarICS } from "../src/services/calendarSync";
import type { Game, Log } from "../src/types";
const game: Game = {
  igdbId: 1,
  title: "Test Quest",
  slug: "test",
  developer: "Test",
  releaseYear: 2024,
  genres: [],
  platforms: ["PS5"],
  addedAt: 1,
  updatedAt: 1,
};
const log: Log = { igdbId: 1, status: "Played", createdAt: 1, updatedAt: 1 };
test("sharing uses recorded completion and platforms without inferring completion from Played", () => {
  for (const completion of [undefined, "Abandoned", "Shelved"] as const)
    assert.match(generateMarkdownList("Test", [{ game, log: { ...log, completion } }]), /- \[ \]/);
  for (const completion of ["Completed", "Mastered"] as const)
    assert.match(generateMarkdownList("Test", [{ game, log: { ...log, completion } }]), /- \[x\]/);
  const md = generateMarkdownList("Test", [
    { game, log: { ...log, completion: "Abandoned", platforms: ["PC", "Switch"] } },
  ]);
  assert.match(md, /Abandoned/);
  assert.match(md, /PC, Switch/);
  assert.doesNotMatch(md, /PS5/);
  assert.doesNotMatch(generateMarkdownList("Test", [{ game, log }]), /PS5/);
});
test("calendar exports disclose date estimates, skip unknown dates and retain recorded outcomes", () => {
  const result = generateCalendarICS([
    { game: { ...game, releaseYear: 0 } },
    { game, log: { ...log, startedAt: "2024-02-30", completion: "Shelved", platform: "PC" } },
  ]);
  assert.equal((result.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(result, /20240701/);
  assert.match(result, /UID:game-1-2024@buildlibraryscreen.local/);
  assert.match(result, /Release year estimate/);
  assert.match(result, /Shelved/);
  assert.doesNotMatch(result, /Platform: PS5/);
});
test("calendar fallback honors a valid release after an impossible recorded date", () => {
  const result = generateCalendarICS([
    {
      game: { ...game, firstReleaseDate: Date.UTC(2024, 11, 31) / 1000 },
      log: { ...log, startedAt: "2024-02-30" },
    },
  ]);
  assert.match(result, /DTSTART;VALUE=DATE:20241231/);
  assert.match(result, /DTEND;VALUE=DATE:20250101/);
});
test("clipboard canvas failures resolve as unsuccessful instead of rejecting", async () => {
  const canvas = {
    toBlob() {
      throw new Error("Blocked canvas");
    },
  } as unknown as HTMLCanvasElement;
  assert.equal(await copyCanvasImageToClipboard(canvas), false);
});
