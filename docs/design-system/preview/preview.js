"use strict";
const FIGMA = "https://www.figma.com/design/PFC9DSki5Eyil4oRWc0x7k";
const boards = [
  [
    "00-cover",
    "Start here",
    "Overview",
    "A calmer system for a personal game library. Start with the design principles, scope, and guide to this file.",
    "12-2",
  ],
  [
    "01-light",
    "Light foundations",
    "Foundations",
    "Semantic color, typography, spacing and geometry in Light mode.",
    "6-2",
  ],
  [
    "01-dark",
    "Dark foundations",
    "Foundations",
    "The same semantic roles, resolved in Dark mode.",
    "6-116",
  ],
  [
    "02-actions",
    "Actions & button states",
    "Components",
    "Primary, secondary, subtle and danger actions across sizes and interaction states.",
    "4-150",
  ],
  [
    "03-inputs",
    "Inputs & selection",
    "Components",
    "Text entry, error states, checkboxes, radios and select controls.",
    "5-95",
  ],
  [
    "04-navigation",
    "Navigation & headings",
    "Components",
    "Destinations, tabs, keyboard focus and a shared page hierarchy.",
    "7-32",
  ],
  [
    "05-content",
    "Content & status",
    "Components",
    "Status badges, truthful metadata, list composition and useful empty states.",
    "8-30",
  ],
  [
    "06-overlays",
    "Overlays & feedback",
    "Components",
    "Dialogs, menus, progress and persistent recovery feedback.",
    "9-93",
  ],
  [
    "07-patterns",
    "UX patterns",
    "Product patterns",
    "Intentional saving, predictable history, collection browsing, recovery and optional AI.",
    "10-2",
  ],
  [
    "08-accessibility",
    "Accessibility",
    "Quality & governance",
    "Selected token contrast checks, keyboard acceptance criteria and verification limits.",
    "11-2",
  ],
  [
    "08-governance",
    "Governance",
    "Quality & governance",
    "Ownership, component lifecycle, contribution rules and evidence-based adoption.",
    "11-64",
  ],
  [
    "08-integration",
    "Design-to-code map",
    "Quality & governance",
    "Manual source mappings and known representation gaps. Code Connect is not enabled.",
    "16-12",
  ],
  [
    "09-context",
    "Context & challenge",
    "Portfolio",
    "The problem, product constraints and design challenge.",
    "13-11",
  ],
  [
    "09-decisions",
    "Design decisions",
    "Portfolio",
    "Four decisions, their reasoning and their tradeoffs.",
    "13-32",
  ],
  [
    "09-system",
    "System architecture",
    "Portfolio",
    "How primitives, semantics, components and patterns fit together.",
    "13-56",
  ],
  [
    "09-evidence",
    "Evidence & next steps",
    "Portfolio",
    "What is verified, what is inferred and what still needs research.",
    "13-94",
  ],
].map(([id, title, group, description, node]) => ({ id, title, group, description, node }));
const flows = {
  "prototype-browse": {
    title: "Browse catalog",
    description: "Preview a game without changing the library.",
    height: 350,
    links: [{ label: "View details", y: 286, target: "prototype-detail" }],
  },
  "prototype-detail": {
    title: "Game details",
    description: "Inspect catalog metadata before starting a draft.",
    height: 406,
    links: [
      { label: "Add to library", y: 286, target: "prototype-draft" },
      { label: "Back to browse", y: 342, target: "prototype-browse" },
    ],
  },
  "prototype-draft": {
    title: "Review your game",
    description: "Only Save commits this illustrative draft.",
    height: 506,
    links: [
      { label: "Save game", y: 386, target: "prototype-saved" },
      { label: "Cancel", y: 442, target: "prototype-detail" },
    ],
  },
  "prototype-saved": {
    title: "Saved to your library",
    description: "Return to the browsing context without revisiting a completed form.",
    height: 394,
    links: [{ label: "Back to browse", y: 286, target: "prototype-browse" }],
  },
};
const byId = (id) => document.getElementById(id);
let current = "00-cover";
let actual = false;
function navigate(id) {
  if (location.hash === "#" + id) render();
  else location.hash = id;
}
function paintNavigation() {
  const query = byId("filter").value.trim().toLowerCase();
  const nav = byId("board-nav");
  nav.replaceChildren();
  let group = "";
  let count = 0;
  for (const board of boards) {
    if (
      query &&
      !`${board.title} ${board.group} ${board.description}`.toLowerCase().includes(query)
    )
      continue;
    if (group !== board.group) {
      group = board.group;
      const heading = document.createElement("h2");
      heading.textContent = group;
      nav.append(heading);
    }
    const link = document.createElement("a");
    link.href = "#" + board.id;
    link.textContent = board.title;
    if (current === board.id) link.setAttribute("aria-current", "page");
    nav.append(link);
    count++;
  }
  byId("no-results").hidden = count !== 0;
}
function render() {
  const requested = location.hash.slice(1);
  const flow = flows[requested];
  const board = boards.find((b) => b.id === requested) || boards[0];
  current = flow ? requested : board.id;
  byId("category").textContent = flow ? "Interactive pattern · fictional demo" : board.group;
  byId("board-title").textContent = flow ? flow.title : board.title;
  byId("board-description").textContent = flow ? flow.description : board.description;
  document.title = `${flow ? flow.title : board.title} · Gamelog design system`;
  const image = byId("board-image");
  image.src = `boards/${current}.png`;
  image.alt = `${flow ? "Illustrative prototype screen" : "Figma design-system board"}: ${flow ? flow.title : board.title}`;
  byId("png-link").href = image.src;
  byId("png-link").setAttribute("download", current + ".png");
  byId("prototype-note").hidden = !flow;
  byId("hotspots").replaceChildren();
  if (flow)
    for (const item of flow.links) {
      const button = document.createElement("button");
      button.className = "hotspot";
      button.setAttribute("aria-label", item.label);
      button.title = item.label;
      button.style.cssText = `left:${(32 / 720) * 100}%;top:${(item.y / flow.height) * 100}%;width:${(152 / 720) * 100}%;height:${(32 / flow.height) * 100}%`;
      button.addEventListener("click", () => navigate(item.target));
      byId("hotspots").append(button);
    }
  const index = boards.indexOf(board);
  byId("page-count").textContent = flow
    ? "4-screen flow"
    : `${index + 1} of ${boards.length} boards`;
  byId("previous").disabled = !!flow || index === 0;
  byId("next").disabled = !!flow || index === boards.length - 1;
  paintNavigation();
  byId("announcement").textContent = `Showing ${flow ? flow.title : board.title}`;
  byId("canvas").scrollTo(0, 0);
}
byId("filter").addEventListener("input", paintNavigation);
byId("previous").addEventListener("click", () =>
  navigate(boards[Math.max(0, boards.findIndex((b) => b.id === current) - 1)].id)
);
byId("next").addEventListener("click", () =>
  navigate(boards[Math.min(boards.length - 1, boards.findIndex((b) => b.id === current) + 1)].id)
);
byId("prototype-link").addEventListener("click", () => navigate("prototype-browse"));
byId("restart").addEventListener("click", () => navigate("prototype-browse"));
function setSize(value) {
  actual = value;
  byId("canvas").classList.toggle("actual", actual);
  byId("fit").setAttribute("aria-pressed", String(!actual));
  byId("actual").setAttribute("aria-pressed", String(actual));
}
byId("fit").addEventListener("click", () => setSize(false));
byId("actual").addEventListener("click", () => setSize(true));
byId("board-image").addEventListener("error", () => {
  byId("announcement").textContent =
    "This board could not be loaded. Extract the full pack and keep the boards folder next to index.html.";
});
window.addEventListener("hashchange", () => {
  render();
  byId("main").focus({ preventScroll: true });
  window.scrollTo(0, 0);
});
if (location.protocol === "file:") {
  byId("offline-note").hidden = false;
}
const compact = window.matchMedia("(max-width:760px)");
function compactNav() {
  byId("navigation").open = !compact.matches;
}
compactNav();
compact.addEventListener("change", compactNav);
render();
