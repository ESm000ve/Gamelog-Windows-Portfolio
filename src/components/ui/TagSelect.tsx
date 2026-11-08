import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Combobox, Option, Tag, TagGroup } from "@fluentui/react-components";
import { TagsRepo } from "../../db/repositories/TagsRepo";
import { useFlyout } from "../../services/overlay";
export function TagSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const tags = useLiveQuery(() => TagsRepo.getAll()) ?? [];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useFlyout();
  const matches = tags.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()));
  const exact = tags.some((tag) => tag.name.toLowerCase() === query.trim().toLowerCase());
  const add = async (name: string) => {
    const tag = await TagsRepo.getOrCreate(name);
    if (!value.includes(tag.id)) onChange([...value, tag.id]);
    setQuery("");
    setOpen(false);
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {value.length > 0 && (
        <TagGroup
          aria-label="Selected tags"
          onDismiss={(_event, data) => onChange(value.filter((id) => id !== data.value))}
        >
          {value.map((id) => (
            <Tag key={id} value={id} dismissible>
              {tags.find((tag) => tag.id === id)?.name ?? "Unknown tag"}
            </Tag>
          ))}
        </TagGroup>
      )}
      <Combobox
        aria-label="Add tags"
        placeholder="Add tags"
        freeform
        multiselect
        value={query}
        selectedOptions={value}
        open={open}
        onOpenChange={(_event, data) => setOpen(data.open)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onOptionSelect={(_event, data) => {
          if (data.optionValue === "create") {
            void add(query.trim());
            return;
          }
          onChange(data.selectedOptions);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && query.trim() && !exact && !event.defaultPrevented) {
            event.preventDefault();
            void add(query.trim());
          }
        }}
      >
        {matches.map((tag) => (
          <Option key={tag.id} value={tag.id}>
            {tag.name}
          </Option>
        ))}
        {query.trim() && !exact && (
          <Option value="create" text={"Create " + query.trim()}>
            Create “{query.trim()}”
          </Option>
        )}
        {!matches.length && !query.trim() && (
          <Option disabled>No tags yet. Type to create one.</Option>
        )}
      </Combobox>
    </div>
  );
}
