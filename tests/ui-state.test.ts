import { test } from "node:test";
import assert from "node:assert/strict";
import { appPlatform, shortcutModifier } from "../src/platform/platform";
import {
  setFlyout,
  getOpenFlyout,
  dismissFlyouts,
  registerDialog,
  hasOpenDialog,
} from "../src/services/overlay";
test("this build always uses Windows presentation and shortcuts", () => {
  assert.equal(appPlatform, "windows");
  assert.equal(shortcutModifier, "Ctrl");
});
test("only one independent flyout can be open and old cleanup cannot close its replacement", () => {
  setFlyout("sort", true);
  assert.equal(getOpenFlyout(), "sort");
  setFlyout("filters", true);
  assert.equal(getOpenFlyout(), "filters");
  setFlyout("sort", false);
  assert.equal(getOpenFlyout(), "filters");
  dismissFlyouts();
  assert.equal(getOpenFlyout(), null);
});
test("opening a modal dismisses flyouts and replaces another dialog without stale cleanup", () => {
  setFlyout("search", true);
  let firstDismissed = 0;
  const closeFirst = registerDialog("add", () => {
    firstDismissed++;
  });
  assert.equal(getOpenFlyout(), null);
  assert.equal(hasOpenDialog(), true);
  const closeSecond = registerDialog("log", () => {});
  assert.equal(firstDismissed, 1);
  closeFirst();
  assert.equal(hasOpenDialog(), true);
  closeSecond();
  assert.equal(hasOpenDialog(), false);
});

test("background flyouts cannot open while a dialog is registered", () => {
  const close = registerDialog("confirmation", () => {});
  setFlyout("late-search", true);
  assert.equal(getOpenFlyout(), null);
  close();
  setFlyout("sort", true);
  assert.equal(getOpenFlyout(), "sort");
  dismissFlyouts();
});
