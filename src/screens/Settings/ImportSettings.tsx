import { Surface } from "../../components/ui/PageLayout";
import { notifyRemoval } from "../../services/feedback";
import { TextInput, TextArea, CheckControl } from "../../components/ui/Controls";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gamepad2,
  PlayCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Check,
} from "../../components/icons";
import {
  parsePlatformList,
  matchPlatformGames,
  importMatchedPlatformGames,
  type PlatformType,
} from "../../services/platformImport";
import type { MatchedImportGame } from "../../services/importSource";
import { Button } from "../../components/ui/Button";

export function ImportSettings() {
  const navigate = useNavigate();
  const [steamId, setSteamId] = useState("");

  // Platform Import States
  const [platformTab, setPlatformTab] = useState<"Steam" | PlatformType>("Steam");
  const [platformText, setPlatformText] = useState("");
  const [platformImporting, setPlatformImporting] = useState(false);
  const [platformProgress, setPlatformProgress] = useState(0);
  const [platformStatus, setPlatformStatus] = useState("");
  const [platformMatches, setPlatformMatches] = useState<MatchedImportGame[]>([]);
  const [platformSelectedIds, setPlatformSelectedIds] = useState<Set<string>>(new Set());
  const [platformSuccessMsg, setPlatformSuccessMsg] = useState("");
  const [platformError, setPlatformError] = useState("");
  const [replacePlaytime, setReplacePlaytime] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("steamId");
    if (saved) setSteamId(saved);
  }, []);

  const handleSteamIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSteamId(e.target.value);
    localStorage.setItem("steamId", e.target.value);
  };

  const handleRunPlatformMatch = async () => {
    if (platformImporting || !platformText.trim() || platformTab === "Steam") return;
    setPlatformImporting(true);
    setPlatformStatus("Parsing titles...");
    setPlatformProgress(10);
    setPlatformMatches([]);
    setPlatformSuccessMsg("");

    try {
      const parsed = parsePlatformList(platformText, platformTab as PlatformType);
      if (parsed.length === 0) {
        setPlatformError(
          "No valid game titles found. Please check your list format — paste one title per line, or Title, Hours."
        );
        setPlatformImporting(false);
        return;
      }
      setPlatformError("");
      const matched = await matchPlatformGames(parsed, (pct, msg) => {
        setPlatformProgress(pct);
        setPlatformStatus(msg);
      });
      setPlatformMatches(matched);
      if (matched.some((match) => match.matchError))
        setPlatformError(
          "Some titles could not be checked because the catalog was unavailable. Retry Match & Preview to check them again."
        );
      // Exact matches are selected; possible matches require explicit review.
      const initialSelected = new Set<string>();
      matched.forEach((m) => {
        if (m.igdbGame && m.confidence === "high") initialSelected.add(m.imported.sourceId);
      });
      setPlatformSelectedIds(initialSelected);
    } catch (err: any) {
      setPlatformError("Error matching games: " + err.message);
    } finally {
      setPlatformImporting(false);
    }
  };

  const handleConfirmPlatformImport = async () => {
    if (platformImporting || platformSelectedIds.size === 0 || platformTab === "Steam") return;
    setPlatformImporting(true);
    setPlatformStatus("Saving to database...");
    try {
      const toImport = platformMatches.filter((m) => platformSelectedIds.has(m.imported.sourceId));
      const { count, recoveryId } = await importMatchedPlatformGames(
        toImport,
        "Backlog",
        replacePlaytime,
        platformTab as PlatformType
      );
      notifyRemoval(`Imported ${count} games`, recoveryId);
      setPlatformSuccessMsg(`Successfully imported ${count} games from ${platformTab}!`);
      setPlatformMatches([]);
      setPlatformText("");
      setPlatformError("");
    } catch (err: any) {
      setPlatformError("Import failed: " + err.message);
    } finally {
      setPlatformImporting(false);
    }
  };

  return (
    <Surface className="settings-card">
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-4)" }}
      >
        <Gamepad2 size={24} color="var(--app-accent)" />
        <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 600 }}>Library imports</h2>
      </div>

      <p
        style={{
          color: "var(--app-secondary-label)",
          marginBottom: "var(--space-5)",
          lineHeight: 1.5,
        }}
      >
        Import your game library and playtimes from major gaming platforms and launchers.
      </p>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: "var(--space-6)",
          borderBottom: "1px solid var(--app-separator)",
          paddingBottom: "var(--space-3)",
          overflowX: "auto",
        }}
      >
        {(["Steam", "PSN", "Xbox", "GOG"] as const).map((tab) => {
          const isSelected = platformTab === tab;
          return (
            <Button
              key={tab}
              type="button"
              disabled={platformImporting}
              aria-pressed={isSelected}
              onClick={() => {
                setPlatformTab(tab);
                setPlatformMatches([]);
                setPlatformSuccessMsg("");
                setPlatformSelectedIds(new Set());
                setPlatformError("");
              }}
              style={{
                padding: "var(--space-2) 18px",
                borderRadius: "var(--radius-xl)",
                background: isSelected ? "var(--app-accent)" : "var(--app-tertiary-bg)",
                color: isSelected ? "var(--app-white)" : "var(--app-label)",
                border: isSelected ? "none" : "1px solid var(--app-separator)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {tab === "PSN"
                ? "PlayStation (PSN)"
                : tab === "Xbox"
                  ? "Xbox Live"
                  : tab === "GOG"
                    ? "GOG Galaxy"
                    : "Steam"}
            </Button>
          );
        })}
      </div>

      {/* Tab 1: Steam */}
      {platformTab === "Steam" && (
        <div>
          <p
            style={{
              color: "var(--app-secondary-label)",
              marginBottom: "var(--space-5)",
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            Connect your public Steam profile to automatically import all owned games and playtimes.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <TextInput
              type="text"
              aria-label="SteamID64"
              placeholder="SteamID64 (e.g. 7656119...)"
              value={steamId}
              onChange={handleSteamIdChange}
              style={{
                padding: "10px var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--app-separator)",
                background: "var(--app-window-bg)",
                color: "var(--app-label)",
                fontSize: 15,
                width: 260,
              }}
            />
            <Button
              variant="primary"
              onClick={() => navigate("/import/steam")}
              disabled={!steamId.trim()}
            >
              <PlayCircle size={18} />
              Fetch from Steam
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2/3/4: PSN, Xbox, GOG */}
      {platformTab !== "Steam" && (
        <div>
          <p
            style={{
              color: "var(--app-secondary-label)",
              marginBottom: "var(--space-4)",
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            Paste your exported list, CSV, or titles from{" "}
            <strong>
              {platformTab === "PSN"
                ? "PlayStation / PSNProfiles"
                : platformTab === "Xbox"
                  ? "Xbox / TrueAchievements"
                  : "GOG Galaxy"}
            </strong>{" "}
            (one title per line, or Title, Hours).
          </p>

          <label
            htmlFor="platform-game-list"
            style={{
              display: "block",
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--app-label)",
              marginBottom: "var(--space-2)",
            }}
          >
            Paste your{" "}
            {platformTab === "PSN"
              ? "PlayStation"
              : platformTab === "Xbox"
                ? "Xbox Live"
                : "GOG Galaxy"}{" "}
            game list
          </label>
          <p
            id="platform-game-list-hint"
            style={{
              fontSize: 12,
              color: "var(--app-tertiary-label)",
              marginBottom: "var(--space-2)",
            }}
          >
            One title per line, or "Title, Hours" format. E.g.:{" "}
            <em>The Witcher 3: Wild Hunt, 120h</em>
          </p>
          <TextArea
            id="platform-game-list"
            aria-describedby="platform-game-list-hint"
            placeholder={`Example:\nThe Witcher 3: Wild Hunt, 120h\nCyberpunk 2077, 65h\nGod of War Ragnarök`}
            value={platformText}
            disabled={platformImporting}
            onChange={(e) => {
              setPlatformText(e.target.value);
              setPlatformMatches([]);
              setPlatformSelectedIds(new Set());
              setPlatformSuccessMsg("");
              setPlatformError("");
            }}
            rows={5}
            style={{
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--app-separator)",
              background: "var(--app-window-bg)",
              color: "var(--app-label)",
              fontSize: 14,
              fontFamily: "var(--app-font-mono)",
              marginBottom: "var(--space-4)",
              resize: "vertical",
            }}
          />

          {platformError && (
            <div
              role="alert"
              style={{
                marginTop: "var(--space-3)",
                padding: "var(--space-3)",
                background: "rgba(255,50,50,0.1)",
                border: "1px solid var(--app-red, #ff3b30)",
                borderRadius: "var(--radius-md)",
                color: "var(--app-red, #ff3b30)",
                fontSize: "var(--font-size-base)",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              {platformError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: "var(--space-5)",
            }}
          >
            <Button
              variant="primary"
              onClick={handleRunPlatformMatch}
              disabled={!platformText.trim() || platformImporting}
            >
              {platformImporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <PlayCircle size={16} />
              )}
              Match & Preview {platformTab} List
            </Button>
          </div>

          {platformImporting && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "var(--space-3)",
                background: "var(--app-tertiary-bg)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: "var(--space-4)",
              }}
            >
              <Loader2 size={18} color="var(--app-accent)" />
              <span style={{ fontSize: "var(--font-size-base)", color: "var(--app-label)" }}>
                {platformStatus || "Processing..."}
              </span>
              <span
                style={{
                  fontSize: "var(--font-size-base)",
                  color: "var(--app-secondary-label)",
                  marginLeft: "auto",
                }}
              >
                {platformProgress}%
              </span>
            </div>
          )}

          {platformSuccessMsg && (
            <div
              role="status"
              style={{
                padding: 14,
                background: "rgba(50, 200, 50, 0.15)",
                border: "1px solid var(--app-green)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: "var(--space-5)",
                color: "var(--app-green)",
              }}
            >
              <CheckCircle2 size={18} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{platformSuccessMsg}</span>
            </div>
          )}

          {/* Matches Preview Table */}
          {platformMatches.length > 0 && (
            <div
              style={{
                background: "var(--app-window-bg)",
                border: "1px solid var(--app-separator)",
                borderRadius: 14,
                padding: "var(--space-4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--app-separator)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--app-label)" }}>
                  Matched Games ({platformSelectedIds.size} of {platformMatches.length} selected)
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmPlatformImport}
                  disabled={platformSelectedIds.size === 0 || platformImporting}
                  style={{ background: "var(--app-green)" }}
                >
                  <Check size={16} /> Import Selected to Backlog
                </Button>
              </div>

              <p style={{ color: "var(--app-secondary-label)", fontSize: 13 }}>
                Exact title matches are selected. Review possible matches before selecting them.
                Existing logs keep their status, notes and ratings.
              </p>
              <CheckControl
                label="Replace existing recorded playtime"
                checked={replacePlaytime}
                disabled={platformImporting}
                onChange={setReplacePlaytime}
              />
              <div
                style={{
                  maxHeight: 300,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {platformMatches.map((match) => {
                  const id = match.imported.sourceId;
                  const isChecked = platformSelectedIds.has(id);
                  const imgUrl = match.igdbGame?.coverUrl;

                  return (
                    <label
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: 8,
                        background: isChecked ? "var(--app-tertiary-bg)" : "transparent",
                        border: "1px solid var(--app-separator)",
                        cursor: "pointer",
                      }}
                    >
                      <TextInput
                        type="checkbox"
                        checked={isChecked}
                        disabled={!match.igdbGame || platformImporting}
                        onChange={(e) => {
                          const next = new Set(platformSelectedIds);
                          if (e.target.checked) next.add(id);
                          else next.delete(id);
                          setPlatformSelectedIds(next);
                        }}
                        style={{ width: 16, height: 16, accentColor: "var(--app-accent)" }}
                      />

                      <div
                        style={{
                          width: 28,
                          height: 36,
                          borderRadius: 4,
                          overflow: "hidden",
                          background: "var(--app-fill)",
                          flexShrink: 0,
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

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--font-size-base)",
                            fontWeight: 600,
                            color: "var(--app-label)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {match.igdbGame ? match.igdbGame.title : match.imported.sourceName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--app-secondary-label)" }}>
                          {match.igdbGame
                            ? `${match.confidence === "low" ? "Possible match — review" : "Exact title match"} (${match.igdbGame.releaseYear || "Year?"})`
                            : (match.matchError ?? "No match found in catalog")}
                          {match.imported.timePlayedHours
                            ? ` • ${match.imported.timePlayedHours}h played`
                            : ""}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px var(--space-2)",
                          borderRadius: 6,
                          background:
                            match.confidence === "high"
                              ? "rgba(50, 215, 75, 0.2)"
                              : match.confidence === "low"
                                ? "rgba(255, 159, 10, 0.2)"
                                : "rgba(255, 69, 58, 0.2)",
                          color:
                            match.confidence === "high"
                              ? "var(--app-green)"
                              : match.confidence === "low"
                                ? "var(--app-orange)"
                                : "var(--app-red)",
                        }}
                      >
                        {match.confidence === "high"
                          ? "Exact Match"
                          : match.confidence === "low"
                            ? "Fuzzy Match"
                            : "Unmatched"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}
