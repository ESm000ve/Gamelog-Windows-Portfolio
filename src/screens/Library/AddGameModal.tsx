import { OperationFeedback } from "../../components/ui/Feedback";
import { TextInput } from "../../components/ui/Controls";
import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Plus, Check, AlertCircle, Sparkles } from "../../components/icons";
import { catalog, type CatalogGame } from "../../catalog";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import { parseLog } from "../../services/ai";
import type { Log } from "../../types";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";

interface AddGameModalProps {
  onClose: () => void;
  onOpenGame: (igdbId: number) => void;
  onStartLog: (game: CatalogGame, prefill?: Partial<Log>) => void;
}

export function AddGameModal({ onClose, onOpenGame, onStartLog }: AddGameModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [quickLogQuery, setQuickLogQuery] = useState("");
  const [quickLogLoading, setQuickLogLoading] = useState(false);
  const [prefill, setPrefill] = useState<Partial<Log>>({});

  const { announce } = useLiveRegion();

  const parseRequest = useRef<AbortController | null>(null);
  useEffect(() => () => parseRequest.current?.abort(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search
  useEffect(() => {
    let mounted = true;
    if (!debouncedQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    catalog.search(debouncedQuery).then(
      (games) => {
        if (!mounted) return;
        setResults(games);
        setLoading(false);
        announce(`Found ${games.length} games matching ${debouncedQuery}`);
      },
      (err) => {
        if (!mounted) return;
        console.error("IGDB search failed:", err);
        setError("Failed to search IGDB. Please try again.");
        setLoading(false);
        announce("Search failed", "assertive");
      }
    );
    return () => {
      mounted = false;
    };
  }, [debouncedQuery]);

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLogQuery.trim() || quickLogLoading) return;

    setQuickLogLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      parseRequest.current = controller;
      const res = await parseLog(quickLogQuery, controller.signal);
      if (controller.signal.aborted) return;
      setPrefill(res.logFields);
      setQuery(res.title);
      announce(`Parsed log for ${res.title}. Select a game to continue.`);
    } catch (err: any) {
      if (parseRequest.current?.signal.aborted) return;
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not parse the sentence. You can still search normally."
      );
      announce("Failed to parse log", "assertive");
    } finally {
      setQuickLogLoading(false);
    }
  };

  // Read existing library to disable "Add" for games already in library
  const libraryIds = useLiveQuery(() => db.games.toCollection().primaryKeys()) as
    number[] | undefined;
  const librarySet = new Set(libraryIds ?? []);

  return (
    <Modal title="Add game" isOpen={true} onClose={onClose} width={600} initialFocusRef={inputRef}>
      {/* Quick Log Form */}
      <form
        onSubmit={handleQuickLog}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--app-separator)",
          background: "var(--app-control-bg)",
          gap: 12,
        }}
      >
        <Sparkles size={18} color="var(--app-accent)" aria-hidden="true" />
        <TextInput
          type="text"
          aria-label="Quick log"
          placeholder='Quick log (e.g. "log Hades, Switch, 4.5 stars, finished Sunday")'
          value={quickLogQuery}
          onChange={(e) => {
            setQuickLogQuery(e.target.value);
            setPrefill({});
            parseRequest.current?.abort();
          }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--app-label)",
            fontSize: 14,
            outline: "none",
          }}
        />
        {quickLogLoading && (
          <Loader2 size={16} color="var(--app-accent)" className="animate-spin" />
        )}
        <Button type="submit" style={{ display: "none" }} />
      </form>

      {Object.keys(prefill).length > 0 && (
        <div style={{ padding: "12px 20px" }} role="status">
          Draft for {query}:{" "}
          {Object.entries(prefill)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
            .join(" · ")}
          . Review these fields in the log editor before saving.{" "}
          <Button variant="ghost" onClick={() => setPrefill({})}>
            Clear draft
          </Button>
        </div>
      )}
      {/* Search Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--app-separator)",
          gap: 12,
        }}
      >
        <h2
          id="add-game-title"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Add game
        </h2>
        <Search size={18} color="var(--app-tertiary-label)" aria-hidden="true" />
        <TextInput
          ref={inputRef}
          type="text"
          aria-label="Search games to add"
          placeholder="Search game title..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPrefill({});
            parseRequest.current?.abort();
          }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--app-label)",
            fontSize: "var(--font-size-lg)",
            outline: "none",
          }}
        />
        {loading && (
          <Loader2 size={16} color="var(--app-tertiary-label)" className="animate-spin" />
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {/* Results Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-3)",
          minHeight: 200,
          maxHeight: "50vh",
        }}
      >
        {error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-xl)",
                background: "var(--app-fill)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertCircle size={20} color="var(--app-red)" aria-hidden="true" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <p
                style={{
                  color: "var(--app-label)",
                  fontSize: "var(--font-size-base)",
                  fontWeight: 500,
                }}
              >
                Search failed
              </p>
              <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-sm)" }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && debouncedQuery && results.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-xl)",
                background: "var(--app-fill)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Search size={20} color="var(--app-tertiary-label)" aria-hidden="true" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <p
                style={{
                  color: "var(--app-label)",
                  fontSize: "var(--font-size-base)",
                  fontWeight: 500,
                }}
              >
                No games found
              </p>
              <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-sm)" }}>
                We couldn't find anything matching "{debouncedQuery}".
              </p>
            </div>
          </div>
        )}

        {!debouncedQuery && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-xl)",
                background: "var(--app-fill)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Search size={20} color="var(--app-tertiary-label)" aria-hidden="true" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <p
                style={{
                  color: "var(--app-label)",
                  fontSize: "var(--font-size-base)",
                  fontWeight: 500,
                }}
              >
                Find a game
              </p>
              <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-sm)" }}>
                Search the IGDB database to add a game.
              </p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((game) => (
            <ResultRow
              key={game.igdbId}
              game={game}
              inLibrary={librarySet.has(game.igdbId)}
              onOpen={() => onOpenGame(game.igdbId)}
              onAdd={async () => onStartLog(game, prefill)}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ResultRow({
  game,
  inLibrary,
  onAdd,
  onOpen,
}: {
  game: CatalogGame;
  inLibrary: boolean;
  onAdd: () => Promise<void>;
  onOpen: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const { announce } = useLiveRegion();

  const handleAdd = async () => {
    if (inLibrary || adding) return;
    setAdding(true);
    setAddError("");
    try {
      await onAdd();
      announce(`Review ${game.title} and save to add it to your library`);
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Could not add this game. Please try again."
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "var(--space-3)",
        borderRadius: "var(--radius-lg)",
        background: "var(--app-fill)",
        gap: 16,
      }}
    >
      <OperationFeedback error={addError} />
      {/* Cover thumb */}
      <div
        style={{
          width: 48,
          height: 64,
          borderRadius: "var(--radius-sm)",
          background: "var(--app-tertiary-bg)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {game.coverUrl && (
          <img
            src={game.coverUrl}
            alt={game.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View ${game.title}`}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--app-label)",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",

            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {game.title}
        </button>
        <p
          style={{
            fontSize: "var(--font-size-base)",
            color: "var(--app-secondary-label)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {game.releaseYear ? `${game.releaseYear} • ` : ""}
          {game.developer}
        </p>
      </div>

      <Button
        variant={inLibrary ? "ghost" : "primary"}
        size="sm"
        onClick={handleAdd}
        disabled={inLibrary || adding}
        aria-label={inLibrary ? `Already added ${game.title}` : `Add ${game.title}`}
        style={{
          flexShrink: 0,
          whiteSpace: "nowrap",
          opacity: adding ? 0.7 : 1,
          color: inLibrary ? "var(--app-tertiary-label)" : undefined,
        }}
      >
        {inLibrary ? (
          <>
            <Check size={14} aria-hidden="true" /> Added
          </>
        ) : (
          <>
            <Plus size={14} aria-hidden="true" /> {adding ? "Adding..." : "Add"}
          </>
        )}
      </Button>
    </div>
  );
}
