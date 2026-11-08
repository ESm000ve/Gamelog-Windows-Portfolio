import { PageHeader } from "../../components/ui/PageLayout";
import { TextInput } from "../../components/ui/Controls";
import { useState, useMemo, useRef, useEffect } from "react";
import { Upload, Users, AlertCircle } from "../../components/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { parseBackup, type BackupData } from "../../services/backup";
import { isFullGame } from "../../services/backupFormat";
import { CoverCard } from "../../components/CoverCard";
import { catalog } from "../../catalog";
import type { Game } from "../../types";
import { Button } from "../../components/ui/Button";

interface FriendsScreenProps {
  onOpenGame?: (igdbId: number) => void;
}

export function FriendsScreen({ onOpenGame }: FriendsScreenProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [friendData, setFriendData] = useState<BackupData | null>(null);
  const [friendGames, setFriendGames] = useState<Record<number, Game>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    []
  );
  const [activeTab, setActiveTab] = useState<"overlap" | "unique" | "hottakes">("overlap");

  const myGames = useLiveQuery(() => db.games.toArray()) ?? [];
  const myLogs = useLiveQuery(() => db.logs.toArray()) ?? [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || loading) return;
    const requestId = ++request.current;
    setLoading(true);
    setError("");
    try {
      const text = await file.text();
      const data = parseBackup(text);
      if (!data.games || !data.logs) throw new Error("Invalid export format");

      const myIgdbIds = new Set(myGames.map((g) => g.igdbId));
      const fetched: Record<number, Game> = {};

      for (const fGame of data.games) {
        if (myIgdbIds.has(fGame.igdbId)) {
          fetched[fGame.igdbId] = myGames.find((g) => g.igdbId === fGame.igdbId)!;
        } else if (isFullGame(fGame)) {
          fetched[fGame.igdbId] = fGame;
        } else {
          const catalogGame = await catalog.fetch(fGame.igdbId);
          if (!catalogGame)
            throw new Error(
              "Some game details could not be loaded. Try again, or ask your friend for a new offline-ready backup."
            );
          if (catalogGame) {
            fetched[fGame.igdbId] = {
              ...catalogGame,
              addedAt: fGame.addedAt,
              updatedAt: fGame.updatedAt,
            };
          }
        }
      }
      if (request.current !== requestId) return;
      setFriendGames(fetched);
      setFriendData(data);
      setActiveTab("overlap");
    } catch (err: any) {
      if (request.current === requestId) setError(err.message || "Failed to load friend's library");
    } finally {
      if (request.current === requestId) setLoading(false);
    }
  };

  const { overlap, unique, hotTakes } = useMemo(() => {
    if (!friendData) return { overlap: [], unique: [], hotTakes: [] };

    const myLogMap = new Map(myLogs.map((l) => [l.igdbId, l]));
    const friendLogMap = new Map(friendData.logs.map((l) => [l.igdbId, l]));

    const overlapIds = [];
    const uniqueIds = [];
    const takes = [];

    for (const fGame of friendData.games) {
      if (myLogMap.has(fGame.igdbId)) {
        overlapIds.push(fGame.igdbId);

        const myLog = myLogMap.get(fGame.igdbId);
        const fLog = friendLogMap.get(fGame.igdbId);
        if (myLog?.rating !== undefined && fLog?.rating !== undefined) {
          const diff = myLog.rating - fLog.rating;
          if (Math.abs(diff) > 0) {
            takes.push({
              igdbId: fGame.igdbId,
              myRating: myLog.rating,
              fRating: fLog.rating,
              diff,
            });
          }
        }
      } else {
        uniqueIds.push(fGame.igdbId);
      }
    }

    takes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return { overlap: overlapIds, unique: uniqueIds, hotTakes: takes };
  }, [friendData, myLogs]);

  return (
    <main
      id="main-content"
      className="friends-screen"
      style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
    >
      <PageHeader
        title="Friends"
        description="Compare a friend's backup locally. Your library is unchanged."
        actions={
          friendData ? (
            <Button loading={loading} onClick={() => fileInputRef.current?.click()}>
              Compare another library
            </Button>
          ) : undefined
        }
      />

      <div style={{ padding: "var(--space-8)", flex: 1, display: "flex", flexDirection: "column" }}>
        <TextInput
          ref={fileInputRef}
          type="file"
          aria-label="Friend library backup"
          accept=".json"
          onChange={handleFileUpload}
          style={{ display: "none" }}
          disabled={loading}
        />
        {loading && <p role="status">Reading library and loading game details…</p>}
        {error && (
          <p role="alert" style={{ color: "var(--app-red)" }}>
            <AlertCircle size={14} aria-hidden="true" /> {error}
            {friendData ? " Your previous comparison is still shown." : ""}
          </p>
        )}

        {!friendData ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                maxWidth: 400,
                width: "100%",
                padding: "var(--space-8)",
                border: "2px dashed var(--app-separator)",
                borderRadius: "var(--radius-2xl)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--app-secondary-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto var(--space-4)",
                }}
              >
                <Users size={24} color="var(--app-tertiary-label)" />
              </div>
              <h2
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: 600,
                  color: "var(--app-label)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Import friend's library
              </h2>
              <p
                style={{
                  fontSize: "var(--font-size-base)",
                  color: "var(--app-secondary-label)",
                  marginBottom: "var(--space-6)",
                }}
              >
                Select a .json export file generated from their Settings page.
              </p>

              <Button
                variant="primary"
                loading={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Choose file
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                borderBottom: "1px solid var(--app-separator)",
                paddingBottom: "var(--space-4)",
              }}
            >
              <TabButton
                active={activeTab === "overlap"}
                onClick={() => setActiveTab("overlap")}
                label={`Overlap (${overlap.length})`}
              />
              <TabButton
                active={activeTab === "unique"}
                onClick={() => setActiveTab("unique")}
                label={`Friend's Unique Games (${unique.length})`}
              />
              <TabButton
                active={activeTab === "hottakes"}
                onClick={() => setActiveTab("hottakes")}
                label={`Hot Takes (${hotTakes.length})`}
              />
            </div>

            {activeTab === "overlap" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 16,
                }}
              >
                {overlap.length === 0 && <p>No games in common yet. Try Friend's Unique Games.</p>}
                {overlap.map((id) => {
                  const game = friendGames[id];
                  if (!game) return null;
                  const log = myLogs.find((l) => l.igdbId === id);
                  return (
                    <CoverCard
                      key={id}
                      game={{
                        ...game,
                        status: log?.status,
                        completion: log?.completion,
                        rating: log?.rating,
                        completionPercentage: log?.completionPercentage,
                      }}
                      onClick={() => onOpenGame?.(id)}
                    />
                  );
                })}
              </div>
            )}

            {activeTab === "unique" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 16,
                }}
              >
                {unique.length === 0 && <p>All of these games are already in your library.</p>}
                {unique.map((id) => {
                  const game = friendGames[id];
                  if (!game) return null;
                  const fLog = friendData!.logs.find((l) => l.igdbId === id);
                  return (
                    <CoverCard
                      key={id}
                      game={{
                        ...game,
                        status: fLog?.status,
                        completion: fLog?.completion,
                        rating: fLog?.rating,
                        completionPercentage: fLog?.completionPercentage,
                      }}
                      onClick={() => onOpenGame?.(id)}
                    />
                  );
                })}
              </div>
            )}

            {activeTab === "hottakes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {hotTakes.length === 0 ? (
                  <p
                    style={{
                      color: "var(--app-tertiary-label)",
                      fontSize: "var(--font-size-base)",
                    }}
                  >
                    No major rating disagreements found!
                  </p>
                ) : (
                  hotTakes.map(({ igdbId, myRating, fRating, diff }) => {
                    const game = friendGames[igdbId];
                    return (
                      <div
                        key={igdbId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "var(--space-4)",
                          background: "var(--app-secondary-bg)",
                          borderRadius: "var(--radius-xl)",
                          border: "1px solid var(--app-separator)",
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 64,
                            borderRadius: "var(--radius-sm)",
                            overflow: "hidden",
                            background: "var(--app-tertiary-bg)",
                            flexShrink: 0,
                          }}
                        >
                          {game?.coverUrl && (
                            <img
                              src={game.coverUrl}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "var(--app-label)",
                              marginBottom: "var(--space-1)",
                            }}
                          >
                            {game?.title}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                            <div>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--app-tertiary-label)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                }}
                              >
                                You
                              </span>
                              <div
                                style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: "var(--app-label)",
                                }}
                              >
                                {myRating} ★
                              </div>
                            </div>
                            <div>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--app-tertiary-label)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                }}
                              >
                                Friend
                              </span>
                              <div
                                style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: "var(--app-label)",
                                }}
                              >
                                {fRating} ★
                              </div>
                            </div>
                            <div
                              style={{
                                paddingLeft: "var(--space-6)",
                                borderLeft: "1px solid var(--app-separator)",
                                color: diff > 0 ? "var(--app-green)" : "var(--app-red)",
                              }}
                            >
                              <span style={{ fontSize: "var(--font-size-base)", fontWeight: 600 }}>
                                {diff > 0 ? "You liked it more" : "They liked it more"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "var(--space-2) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: active ? "var(--app-label)" : "transparent",
        color: active ? "var(--app-bg)" : "var(--app-secondary-label)",
        fontSize: "var(--font-size-base)",
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {label}
    </Button>
  );
}
