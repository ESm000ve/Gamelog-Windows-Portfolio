import { LibraryAssistantDialog } from "../../components/features/LibraryAssistantDialog";
import { PageHeader, EmptyState, CollectionCard } from "../../components/ui/PageLayout";
import { OperationFeedback } from "../../components/ui/Feedback";
import { operationError } from "../../services/feedback";
import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trophy } from "../../components/icons";
import { db } from "../../db/schema";
import { ListsRepo } from "../../db/repositories/ListsRepo";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import { useEffect } from "react";
import type { UserList } from "../../types";
import { Button } from "../../components/ui/Button";

interface ListsScreenProps {
  onOpenList: (listId: string) => void;
}

export function ListsScreen({ onOpenList }: ListsScreenProps) {
  const lists = useLiveQuery(() => db.lists.orderBy("createdAt").reverse().toArray());
  const draftTrigger = useRef<HTMLButtonElement>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const { announce } = useLiveRegion();

  useEffect(() => {
    if (lists !== undefined) {
      announce(`Showing ${lists.length} lists`);
    }
  }, [lists?.length, announce]);

  const handleNewList = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const id = await ListsRepo.create("New List");
      onOpenList(id);
    } catch (error) {
      setError(operationError(error, "Could not create a list. Please try again."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <main
      id="main-content"
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
    >
      <PageHeader
        title="Lists"
        count={`${lists?.length ?? 0} ${lists?.length === 1 ? "list" : "lists"}`}
        actions={
          <>
            <Button ref={draftTrigger} onClick={() => setDraftOpen(true)}>
              Draft a list
            </Button>
            <Button onClick={handleNewList} loading={creating} variant="primary">
              <Plus size={16} />
              New list
            </Button>
          </>
        }
      />

      {draftOpen && (
        <LibraryAssistantDialog
          restoreFocusRef={draftTrigger}
          mode="list"
          onClose={() => setDraftOpen(false)}
          onCreated={onOpenList}
        />
      )}
      <OperationFeedback error={error} />
      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-5) var(--space-8) var(--space-8)",
        }}
      >
        {lists === undefined && (
          <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-base)" }}>
            Loading…
          </p>
        )}

        {lists !== undefined && lists.length === 0 && (
          <EmptyState
            icon={<Trophy size={24} />}
            title="No lists yet"
            description="Create a list to organize your games."
            actions={
              <Button variant="primary" loading={creating} onClick={handleNewList}>
                <Plus size={16} />
                New list
              </Button>
            }
          />
        )}

        {lists !== undefined && lists.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {lists.map((list) => (
              <ListCard key={list.id} list={list} onClick={() => onOpenList(list.id)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── List card ────────────────────────────────────────────────────────────────

function ListCard({ list, onClick }: { list: UserList; onClick: () => void }) {
  // Load the first 4 game covers
  const games = useLiveQuery(async () => {
    if (list.gameIds.length === 0) return [];
    const ids = list.gameIds.slice(0, 4);
    const results = await db.games.where("igdbId").anyOf(ids).toArray();
    // preserve order
    return ids.map((id) => results.find((g) => g.igdbId === id)).filter(Boolean);
  }, [list.id, list.gameIds.join(",")]);

  const covers = games ?? [];

  return (
    <CollectionCard
      aria-label={`${list.name}, ${list.gameIds.length} ${list.gameIds.length === 1 ? "game" : "games"}${list.isRanked ? ", Ranked" : ""}`}
      onClick={onClick}
    >
      {/* 4-cover collage */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          aspectRatio: "16/9",
          overflow: "hidden",
          background: "var(--app-tertiary-bg)",
        }}
      >
        {[0, 1, 2, 3].map((i) => {
          const game = covers[i] as any;
          return (
            <div key={i} style={{ overflow: "hidden", background: "var(--app-fill)" }}>
              {game?.coverUrl ? (
                <img
                  src={game.coverUrl}
                  alt={game.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  draggable={false}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: [
                      "var(--app-fill)",
                      "var(--app-secondary-fill)",
                      "var(--app-tertiary-fill)",
                      "var(--app-quaternary-fill)",
                    ][i % 4],
                  }}
                >
                  {game?.title && (
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--app-secondary-label)",
                        textAlign: "center",
                        padding: "var(--space-1)",
                        lineHeight: 1.3,
                      }}
                    >
                      {game.title}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata */}
      <div
        style={{
          padding: "10px 14px var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
        >
          <p
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--app-label)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {list.name}
          </p>
          {list.isRanked && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 7px",
                borderRadius: "var(--radius-full)",
                background: "color-mix(in srgb, var(--app-yellow) 13%, transparent)",
                border: "1px solid color-mix(in srgb, var(--app-yellow) 25%, transparent)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "var(--app-yellow)",
                flexShrink: 0,
              }}
            >
              <Trophy size={10} aria-hidden="true" /> Ranked
            </span>
          )}
        </div>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--app-tertiary-label)" }}>
          {list.gameIds.length} {list.gameIds.length === 1 ? "game" : "games"}
        </p>
      </div>
    </CollectionCard>
  );
}
