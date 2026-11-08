import { PageHeader } from "../../components/ui/PageLayout";
import { TextInput } from "../../components/ui/Controls";
import { Search, ChevronLeft } from "../../components/icons";
import { Button } from "../../components/ui/Button";

interface SearchToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onBack: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  selectedCount: number;
  totalSelectable: number;
  onToggleSelectAll: () => void;
}

export function SearchToolbar({
  query,
  onQueryChange,
  onBack,
  selectMode,
  onToggleSelectMode,
  selectedCount,
  totalSelectable,
  onToggleSelectAll,
}: SearchToolbarProps) {
  return (
    <PageHeader
      title="Catalog search"
      leading={
        <Button variant="ghost" onClick={onBack} aria-label="Back to Library">
          <ChevronLeft size={20} />
        </Button>
      }
      actions={
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectMode && (
              <Button
                onClick={onToggleSelectAll}
                style={{
                  background: "transparent",
                  color: "var(--app-accent)",
                  border: "none",
                  padding: "var(--space-1) var(--space-2)",
                  fontSize: "var(--font-size-base)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {selectedCount > 0 && selectedCount === totalSelectable
                  ? "Clear selection"
                  : "Select all loaded"}
              </Button>
            )}

            <Button
              onClick={onToggleSelectMode}
              style={{
                background: selectMode ? "var(--app-accent)" : "var(--app-fill)",
                color: selectMode ? "white" : "var(--app-label)",
                border: "1px solid var(--app-separator)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-1) var(--space-3)",
                fontSize: "var(--font-size-base)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {selectMode ? "Cancel" : "Select"}
            </Button>
          </div>

          <div style={{ position: "relative" }}>
            <Search
              size={13}
              color="var(--app-tertiary-label)"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <TextInput
              type="text"
              placeholder="Search catalog to bulk add games..."
              aria-label="Bulk Catalog Search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              style={{
                paddingLeft: 30,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: "var(--radius-sm)",
                background: "var(--app-fill)",
                border: "1px solid var(--app-separator)",
                color: "var(--app-label)",
                fontSize: "var(--font-size-base)",
                width: 300,
                outline: "none",
              }}
            />
          </div>
        </>
      }
    />
  );
}
