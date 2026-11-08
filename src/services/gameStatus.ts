import type { Status, Completion } from "../types";
/** Played records only show an outcome when one was actually recorded. */
export function gameStatusLabel(status: Status, completion?: Completion): Status | Completion {
  return status === "Played" &&
    completion &&
    ["Completed", "Mastered", "Abandoned", "Shelved"].includes(completion)
    ? completion
    : status;
}
