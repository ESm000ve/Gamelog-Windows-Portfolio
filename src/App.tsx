import { catalog, type CatalogGame } from "./catalog";
import { notify, operationError } from "./services/feedback";
import { FeedbackHost } from "./components/ui/Feedback";
import { dismissFlyouts } from "./services/overlay";
import { Games20Regular, Keyboard20Regular } from "@fluentui/react-icons";
import { Button } from "./components/ui/Button";
import { useState, useEffect, lazy } from "react";
import { DeferredPage, DeferredDialog } from "./components/ui/DeferredContent";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Sidebar } from "./shell/Sidebar";
import { LibraryScreen } from "./screens/Library/LibraryScreen";
import { GlobalSearch } from "./shell/GlobalSearch";
import { CommandPalette } from "./components/layout";
import { applyTheme } from "./services/theme";
import { db } from "./db/schema";
import { GamesRepo } from "./db/repositories/GamesRepo";
import type { Game, Log } from "./types";
import "./styles/index.css";

const AddGameModal = lazy(() =>
  import("./screens/Library/AddGameModal").then((module) => ({ default: module.AddGameModal }))
);
const LogEditor = lazy(() =>
  import("./screens/LogEditor").then((module) => ({ default: module.LogEditor }))
);
const GameDetailScreen = lazy(() =>
  import("./screens/GameDetail/GameDetailScreen").then((module) => ({
    default: module.GameDetailScreen,
  }))
);
const RelatedGamesPage = lazy(() =>
  import("./screens/GameDetail/RelatedGamesPage").then((module) => ({
    default: module.RelatedGamesPage,
  }))
);
const ListsScreen = lazy(() =>
  import("./screens/Lists/ListsScreen").then((module) => ({ default: module.ListsScreen }))
);
const SingleListScreen = lazy(() =>
  import("./screens/Lists/SingleListScreen").then((module) => ({
    default: module.SingleListScreen,
  }))
);
const AddToListSheet = lazy(() =>
  import("./screens/Lists/AddToListSheet").then((module) => ({ default: module.AddToListSheet }))
);
const StatsScreen = lazy(() =>
  import("./screens/Stats/StatsScreen").then((module) => ({ default: module.StatsScreen }))
);
const RecommendScreen = lazy(() =>
  import("./screens/Recommend/RecommendScreen").then((module) => ({
    default: module.RecommendScreen,
  }))
);
const SettingsScreen = lazy(() =>
  import("./screens/Settings").then((module) => ({ default: module.SettingsScreen }))
);
const ImportReviewScreen = lazy(() =>
  import("./screens/ImportReview/ImportReviewScreen").then((module) => ({
    default: module.ImportReviewScreen,
  }))
);
const SearchScreen = lazy(() =>
  import("./screens/Search").then((module) => ({ default: module.SearchScreen }))
);
const SystemsScreen = lazy(() =>
  import("./screens/Systems/SystemsScreen").then((module) => ({ default: module.SystemsScreen }))
);
const FriendsScreen = lazy(() =>
  import("./screens/Friends/FriendsScreen").then((module) => ({ default: module.FriendsScreen }))
);
const ActivityScreen = lazy(() =>
  import("./screens/Activity/ActivityScreen").then((module) => ({ default: module.ActivityScreen }))
);

interface LogEditorTarget {
  game: Game;
  log: Log;
  prefill?: Partial<Log>;
  isNew?: boolean;
}

function SingleListRoute({ onOpenGame }: { onOpenGame: (igdbId: number) => void }) {
  const { listId } = useParams();
  const navigate = useNavigate();
  if (!listId) return null;
  return (
    <SingleListScreen listId={listId} onBack={() => navigate("/lists")} onOpenGame={onOpenGame} />
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    dismissFlyouts();
  }, [location.pathname]);

  useEffect(() => {
    applyTheme();
  }, []);

  // Dynamic page title — WCAG 2.4.2
  useEffect(() => {
    const PATH_TITLES: Record<string, string> = {
      "/": "Library",
      "/lists": "Lists",
      "/systems": "Systems",
      "/recommend": "What to play",
      "/activity": "Activity",
      "/friends": "Friends",
      "/stats": "Statistics",
      "/settings": "Settings",
      "/search": "Search",
      "/import/steam": "Import from Steam",
    };
    const base = "gamelog";
    // Match dynamic routes first, fall back to static map
    if (location.pathname.startsWith("/game/")) {
      document.title = location.pathname.endsWith("/related")
        ? `Related games — ${base}`
        : `Game Detail — ${base}`;
    } else if (location.pathname.startsWith("/lists/")) {
      document.title = `List — ${base}`;
    } else if (location.pathname.startsWith("/systems/")) {
      document.title = `System — ${base}`;
    } else {
      const label = PATH_TITLES[location.pathname];
      document.title = label ? `${label} — ${base}` : base;
    }
  }, [location.pathname]);

  // Fill missing cached release dates without triggering optional AI requests.
  useEffect(() => {
    GamesRepo.backfillReleaseDates();
  }, []);

  // Dialogs are transient state on the current page. Replacing their URL keeps
  // native Back/Forward from revisiting completed forms or duplicate pages.
  const [searchParams, setSearchParams] = useSearchParams();

  const addGameOpen = searchParams.get("add-game") === "true";
  const [logEditorTarget, setLogEditorTarget] = useState<LogEditorTarget | null>(null);
  const [draftGame, setDraftGame] = useState<CatalogGame | undefined>(undefined);
  const [prefillState, setPrefillState] = useState<Partial<Log> | undefined>(undefined);
  const addToListIgdbId = searchParams.get("add-to-list");
  const addToListTitle = searchParams.get("list-title") || "";

  useEffect(() => {
    const handleOpenAdd = () => {
      setSearchParams(
        (prev) => {
          prev.delete("log");
          prev.delete("add-to-list");
          prev.set("add-game", "true");
          return prev;
        },
        { replace: true }
      );
    };
    window.addEventListener("gamelog:open-add-game", handleOpenAdd);
    return () => window.removeEventListener("gamelog:open-add-game", handleOpenAdd);
  }, [setSearchParams]);

  const openAddGame = () => {
    setSearchParams(
      (prev) => {
        prev.delete("log");
        prev.delete("add-to-list");
        prev.set("add-game", "true");
        return prev;
      },
      { replace: true }
    );
  };

  const closeAddGame = () => {
    setSearchParams(
      (prev) => {
        prev.delete("add-game");
        return prev;
      },
      { replace: true }
    );
  };

  const logIdParam = searchParams.get("log");
  useEffect(() => {
    let mounted = true;
    setLogEditorTarget(null);
    const id = Number(logIdParam);
    if (logIdParam && Number.isSafeInteger(id) && id > 0) {
      void (async () => {
        try {
          const [storedGame, storedLog] = await Promise.all([db.games.get(id), db.logs.get(id)]);
          const metadata =
            storedGame ?? (draftGame?.igdbId === id ? draftGame : await catalog.fetch(id));
          if (!mounted) return;
          if (!metadata) throw new Error("This game is unavailable. Please try again.");
          const now = Date.now();
          setLogEditorTarget({
            game: storedGame ?? { ...metadata, addedAt: now, updatedAt: now },
            log: storedLog ?? { igdbId: id, status: "Backlog", createdAt: now, updatedAt: now },
            prefill: prefillState,
            isNew: !storedGame,
          });
        } catch (error) {
          if (!mounted) return;
          notify("Could not open game log", {
            intent: "error",
            message: operationError(error, "Please try again."),
          });
          setSearchParams(
            (previous) => {
              previous.delete("log");
              return previous;
            },
            { replace: true }
          );
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [logIdParam, prefillState, draftGame, setSearchParams]);

  const openLogEditor = (igdbId: number, prefill?: Partial<Log>, draft?: CatalogGame) => {
    setDraftGame(draft);
    setPrefillState(prefill);
    setSearchParams(
      (prev) => {
        prev.delete("add-game");
        prev.delete("add-to-list");
        prev.set("log", igdbId.toString());
        return prev;
      },
      { replace: true }
    );
  };

  const closeLogEditor = () => {
    setSearchParams(
      (prev) => {
        prev.delete("log");
        return prev;
      },
      { replace: true }
    );
    setPrefillState(undefined);
    setDraftGame(undefined);
  };

  const openAddToList = (igdbId: number, title: string) => {
    setSearchParams(
      (prev) => {
        prev.delete("add-game");
        prev.delete("log");
        prev.set("add-to-list", igdbId.toString());
        prev.set("list-title", title);
        return prev;
      },
      { replace: true }
    );
  };

  const closeAddToList = () => {
    setSearchParams(
      (prev) => {
        prev.delete("add-to-list");
        prev.delete("list-title");
        return prev;
      },
      { replace: true }
    );
  };

  const openGame = (igdbId: number) => navigate(`/game/${igdbId}`);

  return (
    <div className="app-shell">
      {/* Skip to main content — WCAG 2.4.1 */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-titlebar">
        <div className="app-titlebar-brand">
          <Games20Regular />
          <span>Gamelog</span>
        </div>
        <div className="app-titlebar-search">
          <GlobalSearch />
        </div>
        <div className="app-titlebar-trailing">
          <Button
            variant="ghost"
            aria-label="Open command palette"
            title={"Commands (Ctrl+K)"}
            onClick={() => window.dispatchEvent(new Event("gamelog:open-command-palette"))}
          >
            <Keyboard20Regular />
          </Button>
        </div>
      </header>
      <div className="app-workspace">
        <Sidebar onAddGame={openAddGame} />
        <div className="app-content">
          <DeferredPage resetKey={location.pathname}>
            <Routes>
              <Route
                path="/"
                element={
                  <LibraryScreen
                    onAddGame={openAddGame}
                    onOpenLog={openLogEditor}
                    onOpenGame={openGame}
                  />
                }
              />
              <Route
                path="/search"
                element={<SearchScreen onOpenGame={openGame} onOpenLog={openLogEditor} />}
              />
              <Route
                path="/lists"
                element={<ListsScreen onOpenList={(id) => navigate(`/lists/${id}`)} />}
              />
              <Route path="/lists/:listId" element={<SingleListRoute onOpenGame={openGame} />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/recommend" element={<RecommendScreen />} />
              <Route path="/activity" element={<ActivityScreen />} />
              <Route path="/friends" element={<FriendsScreen onOpenGame={openGame} />} />
              <Route
                path="/systems"
                element={<SystemsScreen onOpenGame={openGame} onOpenLog={openLogEditor} />}
              />
              <Route
                path="/systems/:platformId"
                element={<SystemsScreen onOpenGame={openGame} onOpenLog={openLogEditor} />}
              />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/import/steam" element={<ImportReviewScreen />} />
              <Route
                path="/game/:igdbId"
                element={
                  <GameDetailScreen
                    onOpenLog={openLogEditor}
                    onOpenGame={openGame}
                    onOpenAddToList={openAddToList}
                  />
                }
              />
              <Route
                path="/game/:igdbId/related"
                element={<RelatedGamesPage onOpenGame={openGame} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DeferredPage>
        </div>
      </div>

      {/* Add game modal */}
      {addGameOpen && (
        <DeferredDialog onClose={closeAddGame} title="Add game">
          <AddGameModal
            onClose={closeAddGame}
            onOpenGame={(id) => {
              closeAddGame();
              openGame(id);
            }}
            onStartLog={(game, prefill) => openLogEditor(game.igdbId, prefill, game)}
          />
        </DeferredDialog>
      )}

      {/* Log Editor modal */}
      {logEditorTarget && (
        <DeferredDialog onClose={closeLogEditor} title="Game log">
          <LogEditor
            key={logEditorTarget.game.igdbId}
            game={logEditorTarget.game}
            log={logEditorTarget.log}
            prefill={logEditorTarget.prefill}
            isNew={logEditorTarget.isNew}
            onClose={closeLogEditor}
            onDelete={closeLogEditor}
          />
        </DeferredDialog>
      )}

      {/* Add to list sheet */}
      {addToListIgdbId && (
        <DeferredDialog onClose={closeAddToList} title="Add to list">
          <AddToListSheet
            igdbId={parseInt(addToListIgdbId, 10)}
            title={addToListTitle}
            onClose={closeAddToList}
          />
        </DeferredDialog>
      )}

      {/* Ctrl+K Command Palette */}
      <CommandPalette />
      <FeedbackHost />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
