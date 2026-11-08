import { EmptyState } from "../../components/ui/PageLayout";
import { Loader2 } from "../../components/icons";
import { CoverCard } from "../../components/CoverCard";
import type { CatalogGame } from "../../catalog";
import type { Status, Completion } from "../../types";

interface SearchResultsGridProps {
  results: CatalogGame[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  offset: number;
  debouncedQuery: string;
  hasMore: boolean;
  libraryMap: Map<number, Status>;
  completionMap?: Map<number, Completion | undefined>;
  selectMode: boolean;
  selectedIds: Set<number>;
  observerTarget: React.RefObject<HTMLDivElement | null>;
  onOpenGame?: (id: number) => void;
  onStatusChange: (game: CatalogGame, status: Status) => void;
  onRate: (game: CatalogGame, rating: number) => void;
  onLog: (game: CatalogGame) => void;
  onToggleSelect: (game: CatalogGame, e: React.MouseEvent) => void;
}

export function SearchResultsGrid({
  results,
  loading,
  loadingMore,
  error,
  offset,
  debouncedQuery,
  hasMore,
  libraryMap,
  completionMap,
  selectMode,
  selectedIds,
  observerTarget,
  onOpenGame,
  onStatusChange,
  onRate,
  onLog,
  onToggleSelect,
}: SearchResultsGridProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--space-5) var(--space-8) var(--space-8)",
      }}
    >
      {loading && offset === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 300,
          }}
        >
          <Loader2 size={24} color="var(--app-tertiary-label)" className="animate-spin" />
        </div>
      ) : error ? (
        <EmptyState alert title="Search is unavailable" description={error} />
      ) : results.length === 0 && debouncedQuery ? (
        <EmptyState
          title={`No results for "${debouncedQuery}"`}
          description="Try another title or a shorter search."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "24px 16px",
          }}
        >
          {results.map((game) => {
            const status = libraryMap.get(game.igdbId);
            return (
              <CoverCard
                key={game.igdbId}
                game={{
                  igdbId: game.igdbId,
                  title: game.title,
                  status: status,
                  completion: completionMap?.get(game.igdbId),
                  coverUrl: game.coverUrl,
                  platform: game.platforms?.[0],
                  releaseYear: game.releaseYear,
                }}
                onClick={(_id) => onOpenGame?.(_id)}
                onChangeStatus={(_id, s) => onStatusChange(game, s)}
                onRate={(_id, r) => onRate(game, r)}
                onLog={(_id) => onLog(game)}
                selectable={selectMode && !status}
                selected={selectedIds.has(game.igdbId)}
                onToggleSelect={(_id, e) => onToggleSelect(game, e as any)}
              />
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {hasMore && !loading && debouncedQuery && results.length > 0 && (
        <div
          ref={observerTarget}
          style={{
            height: 40,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "var(--space-5)",
          }}
        >
          {loadingMore ? (
            <Loader2 size={18} color="var(--app-tertiary-label)" className="animate-spin" />
          ) : (
            <span>Scroll for more</span>
          )}
        </div>
      )}
    </div>
  );
}
