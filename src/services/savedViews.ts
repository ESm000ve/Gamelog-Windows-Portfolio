import type { FilterSpec } from "./filterEngine";
import type { SortKey } from "../hooks/useLibrary";
export interface SavedLibraryView {
  id: string;
  name: string;
  filters: FilterSpec;
  search: string;
  sort: SortKey;
  viewMode: "grid" | "table";
}
const key = "gamelog.savedLibraryViews.v1";
const sorts = ["recent", "rating", "title-asc", "title-desc", "year-desc", "year-asc", "time"];
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function validView(value: unknown): value is SavedLibraryView {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 60 ||
    typeof value.search !== "string" ||
    value.search.length > 2000 ||
    !sorts.includes(String(value.sort)) ||
    !["grid", "table"].includes(String(value.viewMode)) ||
    !object(value.filters)
  )
    return false;
  const f = value.filters;
  const allowed = [
    "status",
    "genres",
    "platforms",
    "platformSource",
    "releaseYear",
    "timeToBeat",
    "rating",
    "tagIds",
  ];
  if (Object.keys(f).some((k) => !allowed.includes(k))) return false;
  for (const k of ["status", "genres", "platforms", "tagIds"]) {
    const v = f[k];
    if (
      v !== undefined &&
      (!Array.isArray(v) ||
        v.length > 200 ||
        v.some((x) => typeof x !== "string" || x.length > 200))
    )
      return false;
  }
  if (
    Array.isArray(f.status) &&
    f.status.some((s) => !["Played", "Playing", "Backlog", "Wishlist"].includes(s))
  )
    return false;
  if (f.platformSource !== undefined && f.platformSource !== "recorded") return false;
  for (const k of ["releaseYear", "timeToBeat", "rating"]) {
    const v = f[k];
    if (v === undefined) continue;
    if (!object(v) || Object.keys(v).some((k) => k !== "min" && k !== "max")) return false;
    for (const n of [v.min, v.max])
      if (n !== undefined && (typeof n !== "number" || !Number.isFinite(n) || n < 0)) return false;
    if (typeof v.min === "number" && typeof v.max === "number" && v.min > v.max) return false;
    if (k === "rating" && [v.min, v.max].some((n) => typeof n === "number" && (n < 0.5 || n > 5)))
      return false;
  }
  return true;
}
export function readSavedViews(): SavedLibraryView[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter(validView).slice(0, 20) : [];
  } catch {
    return [];
  }
}
export function storeView(
  draft: Omit<SavedLibraryView, "id">,
  id: string = crypto.randomUUID()
): SavedLibraryView {
  const view = { ...draft, name: draft.name.trim(), id };
  if (!validView(view))
    throw new Error("Choose a name of 1–60 characters and valid filter ranges before saving.");
  const views = readSavedViews();
  if (views.some((v) => v.id !== id && v.name.toLowerCase() === view.name.toLowerCase()))
    throw new Error("A view with this name already exists. Choose another name.");
  const next = [...views.filter((v) => v.id !== id), view];
  if (next.length > 20)
    throw new Error("You can save up to 20 views. Remove one before saving another.");
  localStorage.setItem(key, JSON.stringify(next));
  return view;
}
export function removeView(id: string) {
  localStorage.setItem(key, JSON.stringify(readSavedViews().filter((v) => v.id !== id)));
}
export function restoreView(view: SavedLibraryView) {
  if (readSavedViews().some((v) => v.id === view.id)) throw new Error("This view already exists.");
  return storeView(view, view.id);
}

export function describeSavedView(view: SavedLibraryView): string {
  const f = view.filters;
  const range = (label: string, value?: { min?: number; max?: number }) =>
    value && (value.min !== undefined || value.max !== undefined)
      ? `${label}: ${value.min ?? "any"}–${value.max ?? "any"}`
      : "";
  const filters = [
    view.search ? `Title: ${view.search}` : "",
    f.status?.join(" / "),
    f.genres?.join(", "),
    f.platforms?.join(", "),
    f.tagIds?.length ? `${f.tagIds.length} tags` : "",
    range("Release year", f.releaseYear),
    range("Story hours", f.timeToBeat),
    range("Rating out of 5", f.rating),
  ].filter(Boolean);
  const sortLabels: Record<SortKey, string> = {
    recent: "Recently added",
    rating: "Highest rated first",
    "title-asc": "Title A–Z",
    "title-desc": "Title Z–A",
    "year-desc": "Newest releases first",
    "year-asc": "Oldest releases first",
    time: "Most time played first",
  };
  return [
    ...(filters.length ? filters : ["All games"]),
    sortLabels[view.sort],
    view.viewMode === "grid" ? "Grid" : "Table",
  ].join(" · ");
}
