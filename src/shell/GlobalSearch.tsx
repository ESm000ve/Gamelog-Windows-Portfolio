import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Combobox, Option, Spinner } from "@fluentui/react-components";
import { Search20Regular, ArrowRight20Regular, Checkmark20Regular } from "@fluentui/react-icons";
import { useLiveQuery } from "dexie-react-hooks";
import { catalog, type CatalogGame } from "../catalog";
import { db } from "../db/schema";
import { Button } from "../components/ui/Button";
import "./GlobalSearch.css";
import { useFlyout, hasOpenDialog } from "../services/overlay";
export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useFlyout();
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const ids = useLiveQuery(() => db.games.toCollection().primaryKeys()) ?? [];
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [location.pathname, setOpen]);
  useEffect(() => {
    let active = true;
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void catalog.search(query).then(
        (games) => {
          if (active) {
            setResults(games);
            setLoading(false);
          }
        },
        () => {
          if (active) {
            setError("Search is unavailable. Try again.");
            setLoading(false);
          }
        }
      );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    const focus = () => input.current?.focus();
    window.addEventListener("open-global-search", focus);
    return () => window.removeEventListener("open-global-search", focus);
  }, []);
  const searchAll = () => {
    setOpen(false);
    navigate("/search?q=" + encodeURIComponent(query.trim()));
  };
  const select = (value: string) => {
    setOpen(false);
    if (value === "all") {
      searchAll();
      return;
    }
    const game = results.find((game) => String(game.igdbId) === value);
    if (game) navigate("/game/" + game.igdbId);
  };
  return (
    <div className="global-search-control">
      <Combobox
        freeform
        ref={input}
        aria-label="Search games"
        placeholder="Search games"
        value={query}
        selectedOptions={[]}
        open={open && query.trim().length >= 2}
        onOpenChange={(_e, data) =>
          setOpen(data.open && !hasOpenDialog() && query.trim().length >= 2)
        }
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(e.target.value.trim().length >= 2 && !hasOpenDialog());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.defaultPrevented && query.trim()) {
            e.preventDefault();
            searchAll();
          }
        }}
        onOptionSelect={(_event, data) => {
          if (data.optionValue) void select(data.optionValue);
        }}
        positioning={{ position: "below", align: "start", offset: 4 }}
        listbox={{
          style: { maxHeight: 480, width: 440, maxWidth: "calc(100vw - 32px)", borderRadius: 8 },
        }}
        style={{ flex: "1 1 auto", width: "auto", minWidth: 0 }}
      >
        <Option value="all" text={"Search catalog for " + query}>
          <Search20Regular /> Search catalog for “{query}”
        </Option>
        {loading && (
          <Option disabled text="Searching">
            <Spinner size="tiny" /> Searching…
          </Option>
        )}
        {error && (
          <Option disabled text={error}>
            {error}
          </Option>
        )}
        {!loading &&
          !error &&
          results.map((game) => (
            <Option key={game.igdbId} value={String(game.igdbId)} text={game.title}>
              <div className="global-search-result">
                {game.coverUrl && <img src={game.coverUrl} alt="" />}
                <span>
                  <strong>{game.title}</strong>
                  <small>
                    {game.releaseYear || "Release date unknown"} · {game.developer}
                  </small>
                </span>
                {ids.includes(game.igdbId) ? (
                  <Checkmark20Regular aria-label="In your library" />
                ) : (
                  <ArrowRight20Regular aria-label="View details" />
                )}
              </div>
            </Option>
          ))}
      </Combobox>
      <Button
        variant="ghost"
        aria-label="Search catalog"
        title="Search catalog"
        disabled={!query.trim()}
        onClick={searchAll}
      >
        <Search20Regular />
      </Button>
    </div>
  );
}
