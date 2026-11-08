import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Combobox, Option } from "@fluentui/react-components";
import { db } from "../../db/schema";
import { useFlyout } from "../../services/overlay";
export function LibraryGamePicker({
  excludedIds,
  onSelect,
}: {
  excludedIds: number[];
  onSelect: (id: number) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useFlyout();
  const results =
    useLiveQuery(
      () =>
        db.games
          .filter(
            (game) =>
              !excludedIds.includes(game.igdbId) &&
              game.title.toLowerCase().includes(query.trim().toLowerCase())
          )
          .limit(8)
          .toArray(),
      [query, excludedIds.join(",")]
    ) ?? [];
  return (
    <Combobox
      aria-label="Search library to add a game"
      freeform
      placeholder="Search your library to add a game"
      value={query}
      selectedOptions={[]}
      style={{ width: "100%", marginBottom: 20 }}
      open={open && !!query.trim()}
      onOpenChange={(_e, data) => setOpen(data.open)}
      onChange={(e) => {
        setQuery(e.target.value);
        setOpen(true);
      }}
      onOptionSelect={(_e, data) => {
        if (data.optionValue) {
          void onSelect(Number(data.optionValue));
          setQuery("");
          setOpen(false);
        }
      }}
    >
      {results.map((game) => (
        <Option key={game.igdbId} value={String(game.igdbId)} text={game.title}>
          {game.title}
        </Option>
      ))}
      {!results.length && <Option disabled>No matching games in your library</Option>}
    </Combobox>
  );
}
