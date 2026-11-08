import { test } from "node:test";
import assert from "node:assert/strict";
import { gameStatusLabel } from "../src/services/gameStatus";
import type { Completion, Status } from "../src/types";
test("Played never implies Completed and only uses a recorded valid outcome", () => {
  assert.equal(gameStatusLabel("Played"), "Played");
  for (const completion of ["Completed", "Mastered", "Abandoned", "Shelved"] as Completion[])
    assert.equal(gameStatusLabel("Played", completion), completion);
  assert.equal(gameStatusLabel("Played", "invalid" as Completion), "Played");
});
test("stale outcomes never override Backlog, Playing or Wishlist", () => {
  for (const status of ["Backlog", "Playing", "Wishlist"] as Status[]) {
    assert.equal(gameStatusLabel(status), status);
    assert.equal(gameStatusLabel(status, "Completed"), status);
    assert.equal(gameStatusLabel(status, "Abandoned"), status);
  }
});
