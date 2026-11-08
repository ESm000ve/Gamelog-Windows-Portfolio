import { PageHeader } from "../../components/ui/PageLayout";
import { RecoveryRepo } from "../../db/repositories/RecoveryRepo";
import { OperationFeedback } from "../../components/ui/Feedback";
import { notifyRemoval, operationError } from "../../services/feedback";
import { TextInput } from "../../components/ui/Controls";
import { Search } from "../../components/icons";
import { LibraryGamePicker } from "../../components/features/LibraryGamePicker";
import { ActionMenu } from "../../components/ui/ActionMenu";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  MoreHorizontal,
  Trophy,
  GripVertical,
  Trash2,
  Share2,
} from "../../components/icons";
import { db } from "../../db/schema";
import { useListEntries } from "../../hooks/useLists";
import { ListsRepo } from "../../db/repositories/ListsRepo";
import { ShareListModal } from "../../components/features/ShareListModal";
import { Button } from "../../components/ui/Button";
import type { Game } from "../../types";

interface SingleListScreenProps {
  listId: string;
  onBack: () => void;
  onOpenGame: (igdbId: number) => void;
}

export function SingleListScreen({ listId, onBack, onOpenGame }: SingleListScreenProps) {
  const list = useLiveQuery(() => db.lists.get(listId), [listId]);

  const games = useLiveQuery(async () => {
    if (!list || list.gameIds.length === 0) return [];
    const all = await db.games.where("igdbId").anyOf(list.gameIds).toArray();
    return list.gameIds.map((id) => all.find((g) => g.igdbId === id)).filter(Boolean) as Game[];
  }, [listId, list?.gameIds.join(",")]);

  const entries = useListEntries(list?.gameIds ?? []);

  const [busy, setBusy] = useState(false);
  const [operationFailure, setOperationFailure] = useState("");
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setOperationFailure("");
    try {
      await operation();
      return true;
    } catch (error) {
      setOperationFailure(operationError(error, "Could not update this list. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const listActionsRef = useRef<HTMLButtonElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const shareOpen = searchParams.get("share-list") === "true";
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  if (!list) {
    return (
      <ScreenShell title="List" onBack={onBack}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-base)" }}>
            Loading…
          </p>
        </div>
      </ScreenShell>
    );
  }

  // ── Rename ──────────────────────────────────────────────────────────────────
  const startRename = () => {
    setNameInput(list.name);
    setRenaming(true);
  };
  const commitRename = async () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== list.name) {
      if (await run(() => ListsRepo.update(listId, { name: trimmed }))) setRenaming(false);
    } else setRenaming(false);
  };

  // ── Toggle ranked ───────────────────────────────────────────────────────────
  const toggleRanked = () => run(() => ListsRepo.update(listId, { isRanked: !list.isRanked }));

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    await run(async () => {
      const recoveryId = await RecoveryRepo.removeList(listId);
      notifyRemoval(`List removed: ${list.name}`, recoveryId);
      onBack();
    });
  };

  // ── Remove game ─────────────────────────────────────────────────────────────
  const removeGame = (igdbId: number) =>
    run(async () => {
      const recoveryId = await RecoveryRepo.removeListGame(listId, igdbId);
      notifyRemoval("Game removed from list", recoveryId);
    });

  // ── Add game from search ─────────────────────────────────────────────────────
  const addGame = async (igdbId: number) => {
    await run(() => ListsRepo.addGame(listId, igdbId));
  };

  // ── Drag-to-reorder ─────────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOver(idx);
  };
  const handleDrop = async (targetIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === targetIdx) {
      setDragOver(null);
      return;
    }
    const newOrder = [...list.gameIds];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(targetIdx, 0, moved);
    await run(() => ListsRepo.update(listId, { gameIds: newOrder }));
    dragIdx.current = null;
    setDragOver(null);
  };

  // Keyboard reorder: move item up/down with Alt+Arrow
  const keyboardMove = async (idx: number, dir: "up" | "down") => {
    const newOrder = [...list.gameIds];
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    await run(() => ListsRepo.update(listId, { gameIds: newOrder }));
  };

  const gamesList = games ?? [];

  return (
    <ScreenShell
      title={renaming ? "" : list.name}
      onBack={onBack}
      titleNode={
        renaming ? (
          <TextInput
            autoFocus
            aria-label="List name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            style={{
              fontFamily: "var(--app-font-display)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--app-label)",
              background: "var(--app-fill)",
              borderRadius: "var(--radius-sm)",
              padding: "2px var(--space-2)",
              border: "1px solid var(--app-accent)",
              outline: "none",
              minWidth: 120,
            }}
          />
        ) : undefined
      }
      controls={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Ranked toggle */}
          <Button
            onClick={toggleRanked}
            title={list.isRanked ? "Switch to unranked" : "Switch to ranked"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "var(--space-1) 10px",
              borderRadius: "var(--radius-full)",
              background: list.isRanked
                ? "color-mix(in srgb, var(--app-yellow) 13%, transparent)"
                : "var(--app-fill)",
              border: `1px solid ${list.isRanked ? "color-mix(in srgb, var(--app-yellow) 25%, transparent)" : "var(--app-separator)"}`,
              color: list.isRanked ? "var(--app-yellow)" : "var(--app-secondary-label)",
              fontSize: "var(--font-size-sm)",
              fontWeight: list.isRanked ? 600 : 400,
              textAlign: "center",
            }}
          >
            <Trophy size={12} />
            {list.isRanked ? "Ranked" : "Unranked"}
          </Button>

          {/* Share button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSearchParams((prev) => {
                prev.set("share-list", "true");
                return prev;
              })
            }
            title="Share & Export List"
            style={{
              borderRadius: "var(--radius-full)",
              padding: "var(--space-1) 10px",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
            }}
          >
            <Share2 size={13} color="var(--app-accent)" />
            Share
          </Button>

          <ActionMenu
            label="List actions"
            trigger={
              <Button ref={listActionsRef} variant="ghost" aria-label="List actions">
                <MoreHorizontal size={20} />
              </Button>
            }
            items={[
              { key: "rename", label: "Rename list", onClick: startRename },
              {
                key: "delete",
                label: "Delete list",
                danger: true,
                onClick: () => setConfirmDelete(true),
              },
            ]}
          />
        </div>
      }
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-5) var(--space-8) var(--space-8)",
        }}
      >
        <ConfirmDialog
          restoreFocusRef={listActionsRef}
          isOpen={confirmDelete}
          title="Delete list?"
          confirmLabel="Delete list"
          danger
          busy={busy}
          error={operationFailure}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        >
          Delete "{list.name}"? Games in this list will stay in your library. You can restore the
          list from Recently removed.
        </ConfirmDialog>
        {list && shareOpen && (
          <ShareListModal
            isOpen={shareOpen}
            title={list.name}
            entries={entries ?? []}
            onClose={() =>
              setSearchParams((prev) => {
                prev.delete("share-list");
                return prev;
              })
            }
          />
        )}

        <OperationFeedback
          error={operationFailure}
          busy={busy}
          message={busy ? "Updating list..." : undefined}
        />
        {/* Hidden drag instructions for screen readers */}
        <div
          id="drag-instructions"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Press Alt plus Up or Down arrow to reorder items.
        </div>

        <LibraryGamePicker excludedIds={list.gameIds} onSelect={addGame} />

        {/* List count */}
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--app-tertiary-label)",
            marginBottom: "var(--space-4)",
          }}
        >
          {list.gameIds.length} {list.gameIds.length === 1 ? "game" : "games"}
          {list.isRanked && " · Drag or use Alt+↑/↓ to reorder"}
        </p>

        {/* Empty state */}
        {gamesList.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 300,
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
              <Search size={20} color="var(--app-tertiary-label)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <p
                style={{
                  color: "var(--app-label)",
                  fontSize: "var(--font-size-base)",
                  fontWeight: 500,
                }}
              >
                This list is empty
              </p>
              <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-sm)" }}>
                Search above to add games.
              </p>
            </div>
          </div>
        )}

        {/* Ranked: vertical numbered list */}
        {list.isRanked && gamesList.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gamesList.map((game, idx) => (
              <div
                key={game.igdbId}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(idx)}
                onKeyDown={(e) => {
                  if (e.altKey && e.key === "ArrowUp") {
                    e.preventDefault();
                    keyboardMove(idx, "up");
                  }
                  if (e.altKey && e.key === "ArrowDown") {
                    e.preventDefault();
                    keyboardMove(idx, "down");
                  }
                }}
                tabIndex={0}
                aria-label={`${idx + 1}. ${game.title}. Alt+Arrow to reorder.`}
                aria-describedby="drag-instructions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px var(--space-3)",
                  borderRadius: "var(--radius-lg)",
                  background: dragOver === idx ? "var(--app-fill)" : "var(--app-tertiary-bg)",
                  border: `1px solid ${dragOver === idx ? "var(--app-accent)" : "var(--app-separator)"}`,
                  cursor: "grab",
                  transition: "background 120ms ease, border-color 120ms ease",
                  outline: "none",
                }}
              >
                {/* Rank number */}
                <span
                  style={{
                    fontFamily: "var(--app-font-display)",
                    fontSize: "var(--font-size-lg)",
                    fontWeight: 700,
                    color: "var(--app-tertiary-label)",
                    minWidth: 28,
                    textAlign: "right",
                  }}
                >
                  {idx + 1}
                </span>

                {/* Drag handle */}
                <GripVertical
                  size={14}
                  color="var(--app-tertiary-label)"
                  style={{ flexShrink: 0 }}
                />

                {/* Cover */}
                <div
                  style={{
                    width: 36,
                    height: 48,
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "var(--app-tertiary-bg)",
                  }}
                >
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl}
                      alt={game.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      draggable={false}
                    />
                  ) : null}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    onClick={() => onOpenGame(game.igdbId)}
                    style={{
                      fontSize: "var(--font-size-base)",
                      fontWeight: 600,
                      color: "var(--app-label)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-label)")}
                  >
                    {game.title}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--app-tertiary-label)", marginTop: 2 }}>
                    {game.developer}
                    {game.releaseYear ? ` · ${game.releaseYear}` : ""}
                  </p>
                </div>

                {/* Remove */}
                <Button
                  onClick={() => removeGame(game.igdbId)}
                  title="Remove from list"
                  aria-label={`Remove ${game.title} from list`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "transparent",
                    color: "var(--app-tertiary-label)",
                    flexShrink: 0,
                    textAlign: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,59,48,0.12)";
                    e.currentTarget.style.color = "var(--app-red)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--app-tertiary-label)";
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Unranked: cover grid */}
        {!list.isRanked && gamesList.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap: "20px 14px",
            }}
          >
            {gamesList.map((game) => (
              <UnrankedCard
                key={game.igdbId}
                game={game}
                onOpen={() => onOpenGame(game.igdbId)}
                disabled={busy}
                onRemove={() => removeGame(game.igdbId)}
              />
            ))}
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UnrankedCard({
  game,
  onOpen,
  onRemove,
  disabled,
}: {
  game: Game;
  onOpen: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <article style={{ minWidth: 0, display: "grid", gap: 8 }}>
      <button
        type="button"
        aria-label={`Open ${game.title}`}
        onClick={onOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          aspectRatio: "3/4",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--app-tertiary-bg)",
          border: "1px solid var(--app-separator)",
        }}
      >
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        ) : (
          <span style={{ padding: 12, fontSize: 14 }}>{game.title}</span>
        )}
      </button>
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        <p
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {game.title}
        </p>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label={`Remove ${game.title} from list`}
          title="Remove from list"
          onClick={onRemove}
          style={{ minWidth: 32, width: 32, color: "var(--app-red)" }}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </article>
  );
}

function ScreenShell({
  title,
  titleNode,
  controls,
  onBack,
  children,
}: {
  title: string;
  titleNode?: React.ReactNode;
  controls?: React.ReactNode;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
    >
      <PageHeader
        title={titleNode ?? title}
        leading={
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft size={16} />
            Lists
          </Button>
        }
        actions={controls}
      />
      {children}
    </main>
  );
}
