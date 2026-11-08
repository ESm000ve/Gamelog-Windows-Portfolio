import { TextInput } from "../ui/Controls";
import { shortcutModifier } from "../../platform/platform";
import { Modal } from "../ui/Modal";
import { hasOpenDialog } from "../../services/overlay";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  Command,
  BookOpen,
  Sparkles,
  Trophy,
  Users,
  BarChart2,
  Settings,
  Plus,
  Flame,
  List,
  Gamepad2,
} from "../icons";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";

interface CommandItem {
  id: string;
  category: "Navigation" | "Actions" | "Library games";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const games = useLiveQuery(() => db.games.toArray(), [], []);
  const logs = useLiveQuery(() => db.logs.toArray(), [], []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasOpenDialog() && !isOpen) return;
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "/" && !isOpen) {
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          setIsOpen(true);
        }
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    const openCommand = () => {
      if (!hasOpenDialog()) setIsOpen(true);
    };
    window.addEventListener("gamelog:open-command-palette", openCommand);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("gamelog:open-command-palette", openCommand);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build items list
  const navItems: CommandItem[] = [
    {
      id: "nav-library",
      category: "Navigation",
      title: "Library",
      subtitle: "Browse your games collection",
      icon: <BookOpen size={18} color="var(--app-accent)" />,
      onSelect: () => navigate("/"),
    },
    {
      id: "nav-lists",
      category: "Navigation",
      title: "Lists",
      subtitle: "Organize custom game lists and collections",
      icon: <List size={18} color="var(--app-blue)" />,
      onSelect: () => navigate("/lists"),
    },
    {
      id: "nav-systems",
      category: "Navigation",
      title: "Browse systems",
      subtitle: "Browse your games by hardware platform",
      icon: <Gamepad2 size={18} color="var(--app-indigo)" />,
      onSelect: () => navigate("/systems"),
    },
    {
      id: "nav-what-to-play",
      category: "Navigation",
      title: "What to play",
      subtitle: "Recommendations and Backlog Roulette",
      icon: <Sparkles size={18} color="var(--app-orange)" />,
      onSelect: () => navigate("/recommend"),
    },
    {
      id: "nav-activity",
      category: "Navigation",
      title: "Activity",
      subtitle: "365-day heatmap, timeline, and Year in Review",
      icon: <Trophy size={18} color="var(--app-yellow)" />,
      onSelect: () => navigate("/activity"),
    },
    {
      id: "nav-friends",
      category: "Navigation",
      title: "Friends",
      subtitle: "Compare library overlap and hot takes",
      icon: <Users size={18} color="var(--app-purple)" />,
      onSelect: () => navigate("/friends"),
    },
    {
      id: "nav-stats",
      category: "Navigation",
      title: "Statistics",
      subtitle: "Burndown charts and gaming habits",
      icon: <BarChart2 size={18} color="var(--app-green)" />,
      onSelect: () => navigate("/stats"),
    },
    {
      id: "nav-settings",
      category: "Navigation",
      title: "Settings",
      subtitle: "Appearance, themes, backup, and imports",
      icon: <Settings size={18} color="var(--app-secondary-label)" />,
      onSelect: () => navigate("/settings"),
    },
  ];

  const actionItems: CommandItem[] = [
    {
      id: "act-add",
      category: "Actions",
      title: "Add game to library",
      subtitle: "Search IGDB catalog to track a game",
      icon: <Plus size={18} color="var(--app-accent)" />,
      onSelect: () => {
        window.dispatchEvent(new CustomEvent("gamelog:open-add-game"));
      },
    },
    {
      id: "act-roulette",
      category: "Actions",
      title: "Spin game roulette",
      subtitle: "Choose from your backlog, current games and old favorites",
      icon: <Flame size={18} color="var(--app-red)" />,
      onSelect: () => {
        navigate("/recommend", {
          replace: location.pathname === "/recommend",
          state: { openRoulette: true },
        });
      },
    },
    {
      id: "act-year-in-review",
      category: "Actions",
      title: "Open year in review",
      subtitle: "View your annual gaming story and wrapped slides",
      icon: <Trophy size={18} color="var(--app-yellow)" />,
      onSelect: () => {
        navigate("/activity", { state: { openYearInReview: true } });
        window.dispatchEvent(new CustomEvent("gamelog:open-year-in-review"));
      },
    },
  ];

  const gameItems: CommandItem[] = (games || []).slice(0, 30).map((game) => {
    const log = (logs || []).find((l) => l.igdbId === game.igdbId);
    const imgUrl = game.coverUrl;
    return {
      id: `game-${game.igdbId}`,
      category: "Library games",
      title: game.title,
      subtitle: `${log?.status || "Unlogged"} • ${game.releaseYear || "Unknown Year"}`,
      icon: (
        <div
          style={{
            width: 20,
            height: 26,
            borderRadius: 3,
            overflow: "hidden",
            background: "var(--app-tertiary-bg)",
          }}
        >
          {imgUrl && (
            <img
              src={imgUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </div>
      ),
      onSelect: () => navigate(`/game/${game.igdbId}`),
    };
  });

  // Filter items
  const q = query.trim().toLowerCase();
  const allItems = [...actionItems, ...navItems, ...gameItems].filter((item) => {
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Reset selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= allItems.length) {
      setSelectedIndex(Math.max(0, allItems.length - 1));
    }
  }, [allItems.length, selectedIndex]);

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % (allItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + (allItems.length || 1)) % (allItems.length || 1));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      allItems[selectedIndex].onSelect();
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen && allItems[selectedIndex])
      document
        .getElementById(`command-item-${allItems[selectedIndex].id}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [isOpen, selectedIndex, allItems[selectedIndex]?.id]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Command palette"
      width={640}
      initialFocusRef={inputRef}
    >
      {/* Search bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--app-separator)",
          gap: 12,
          background: "var(--app-secondary-bg)",
        }}
      >
        <Search size={20} color="var(--app-accent)" />
        <TextInput
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search commands and library"
          aria-autocomplete="list"
          aria-expanded={true}
          aria-controls="command-results"
          aria-activedescendant={
            allItems[selectedIndex] ? `command-item-${allItems[selectedIndex].id}` : undefined
          }
          placeholder="Type a command or search your games… (e.g., 'Activity', 'Roulette', 'Zelda')"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDownInInput}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--app-label)",
            fontSize: "var(--font-size-lg)",
            fontWeight: 500,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "var(--space-1) var(--space-2)",
            borderRadius: 6,
            background: "var(--app-tertiary-bg)",
            border: "1px solid var(--app-separator)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--app-secondary-label)",
          }}
        >
          ESC
        </div>
      </div>

      {/* Results list */}
      <div
        id="command-results"
        role="listbox"
        aria-label="Commands and library"
        style={{ flex: 1, overflowY: "auto", padding: "var(--space-3) 10px", minHeight: 0 }}
      >
        {allItems.length === 0 ? (
          <div
            style={{
              padding: "var(--space-10) var(--space-5)",
              textAlign: "center",
              color: "var(--app-secondary-label)",
              fontSize: 14,
            }}
          >
            No matching results found for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          allItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            const showHeader = index === 0 || allItems[index - 1].category !== item.category;

            return (
              <div key={item.id}>
                {showHeader && (
                  <div
                    style={{
                      padding: "10px 14px 6px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--app-secondary-label)",
                      textTransform: "none",
                      letterSpacing: "normal",
                    }}
                  >
                    {item.category}
                  </div>
                )}
                <div
                  role="option"
                  id={`command-item-${item.id}`}
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    item.onSelect();
                    setIsOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 14px",
                    borderRadius: 4,
                    background: isSelected ? "var(--app-secondary-fill)" : "transparent",
                    color: "var(--app-label)",
                    cursor: "pointer",
                    transition: "background 100ms ease",
                  }}
                >
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: "var(--font-size-sm)",
                          color: "var(--app-secondary-label)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 2,
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, opacity: 0.8 }}>
                      ↵ Select
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hints */}
      <div
        style={{
          padding: "10px var(--space-5)",
          background: "var(--app-tertiary-bg)",
          borderTop: "1px solid var(--app-separator)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "var(--font-size-sm)",
          color: "var(--app-secondary-label)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>
            <kbd
              style={{
                background: "var(--app-fill)",
                padding: "2px 6px",
                borderRadius: 4,
                marginRight: "var(--space-1)",
              }}
            >
              ↑↓
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd
              style={{
                background: "var(--app-fill)",
                padding: "2px 6px",
                borderRadius: 4,
                marginRight: "var(--space-1)",
              }}
            >
              ↵
            </kbd>{" "}
            Select
          </span>
          <span>
            <kbd
              style={{
                background: "var(--app-fill)",
                padding: "2px 6px",
                borderRadius: 4,
                marginRight: "var(--space-1)",
              }}
            >
              ESC
            </kbd>{" "}
            Close
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
            color: "var(--app-accent)",
          }}
        >
          <Command size={14} /> {shortcutModifier}+K Command palette
        </div>
      </div>
    </Modal>
  );
}
