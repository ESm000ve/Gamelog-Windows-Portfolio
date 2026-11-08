import "./FilterBar.css";
import { TextInput, SelectControl } from "../ui/Controls";
import {
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Checkbox as FluentCheckbox,
} from "@fluentui/react-components";
import { useFlyout } from "../../services/overlay";
import { useState, useEffect } from "react";
import { Filter, X } from "../icons";
import type { FilterSpec } from "../../services/filterEngine";
import { TagsRepo } from "../../db/repositories/TagsRepo";
import type { Tag, Status } from "../../types";
import { Button } from "../ui/Button";

// Predefined lists for simplicity. In a real app, these might be aggregated from the library.
const STATUSES: Status[] = ["Playing", "Backlog", "Played", "Wishlist"];
const GENRES = [
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Simulation",
  "Sports",
  "Puzzle",
  "Indie",
  "Shooter",
  "Platform",
  "Fighting",
  "Racing",
  "Arcade",
  "Music",
  "Point-and-click",
  "Visual Novel",
  "Card & Board Game",
  "Tactical",
  "Hack and slash/Beat 'em up",
];
const PLATFORMS = [
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch",
  "iOS",
  "Android",
];

interface FilterBarProps {
  spec: FilterSpec;
  onChange: (spec: FilterSpec) => void;
  genres?: string[];
  platforms?: string[];
}

export function FilterBar({ spec, onChange, genres = [], platforms = [] }: FilterBarProps) {
  const [isOpen, setIsOpen] = useFlyout();
  const [tags, setTags] = useState<Tag[]>([]);
  useEffect(() => {
    if (isOpen)
      void TagsRepo.getAll()
        .then(setTags)
        .catch(() => setTags([]));
  }, [isOpen]);
  const activeCount =
    (spec.status?.length || 0) +
    (spec.genres?.length || 0) +
    (spec.platforms?.length || 0) +
    (spec.tagIds?.length || 0) +
    (spec.releaseYear ? 1 : 0) +
    (spec.timeToBeat ? 1 : 0) +
    (spec.rating ? 1 : 0);
  const toggle = (key: "status" | "genres" | "platforms" | "tagIds", value: string) => {
    const current = (spec[key] as string[]) ?? [];
    onChange({
      ...spec,
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };
  const range = (key: "releaseYear" | "timeToBeat" | "rating", min?: number, max?: number) =>
    onChange({ ...spec, [key]: min === undefined && max === undefined ? undefined : { min, max } });
  return (
    <Popover
      open={isOpen}
      onOpenChange={(_e, data) => setIsOpen(data.open)}
      positioning={{
        position: "below",
        align: "end",
        offset: 4,
        autoSize: "height",
        overflowBoundaryPadding: 8,
      }}
    >
      <PopoverTrigger disableButtonEnhancement>
        <Button variant="secondary" aria-label="Filters">
          <Filter size={20} />
          Filters{activeCount > 0 ? " (" + activeCount + ")" : ""}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className="app-filter-surface" aria-label="Library filters" role="dialog">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 20, fontWeight: 600 }}>Filters</h3>
          <Button variant="ghost" aria-label="Close filters" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </Button>
        </div>
        <FacetGroup label="Status">
          {STATUSES.map((value) => (
            <Checkbox
              key={value}
              label={value}
              checked={spec.status?.includes(value) ?? false}
              onChange={() => toggle("status", value)}
            />
          ))}
        </FacetGroup>
        <FacetGroup label="Genres">
          {[...new Set([...GENRES, ...genres, ...(spec.genres ?? [])])].sort().map((value) => (
            <Checkbox
              key={value}
              label={value}
              checked={spec.genres?.includes(value) ?? false}
              onChange={() => toggle("genres", value)}
            />
          ))}
        </FacetGroup>
        <label className="library-platform-source">
          Match platforms by
          <SelectControl
            aria-label="Platform filter source"
            value={spec.platformSource ?? "catalog"}
            onChange={(event) =>
              onChange({
                ...spec,
                platformSource: event.target.value === "recorded" ? "recorded" : undefined,
              })
            }
          >
            <option value="catalog">Catalog availability</option>
            <option value="recorded">Logged or exclusive platforms</option>
          </SelectControl>
        </label>
        <p className="library-filter-help">
          Catalog platforms describe availability, not ownership.
        </p>
        <FacetGroup label="Platforms">
          {[...new Set([...PLATFORMS, ...platforms, ...(spec.platforms ?? [])])]
            .sort()
            .map((value) => (
              <Checkbox
                key={value}
                label={value}
                checked={spec.platforms?.includes(value) ?? false}
                onChange={() => toggle("platforms", value)}
              />
            ))}
        </FacetGroup>
        {tags.length > 0 && (
          <FacetGroup label="Tags">
            {tags.map((tag) => (
              <Checkbox
                key={tag.id}
                label={tag.name}
                checked={spec.tagIds?.includes(tag.id) ?? false}
                onChange={() => toggle("tagIds", tag.id)}
              />
            ))}
          </FacetGroup>
        )}
        <RangeFacet
          label="Release year"
          min={spec.releaseYear?.min}
          max={spec.releaseYear?.max}
          onChange={(min, max) => range("releaseYear", min, max)}
          placeholderMin="Any"
          placeholderMax="Any"
        />
        <RangeFacet
          label="Length (hours)"
          min={spec.timeToBeat?.min}
          max={spec.timeToBeat?.max}
          onChange={(min, max) => range("timeToBeat", min, max)}
          placeholderMin="Any"
          placeholderMax="Any"
        />
        <RangeFacet
          label="Rating (stars)"
          min={spec.rating?.min}
          max={spec.rating?.max}
          onChange={(min, max) => range("rating", min, max)}
          placeholderMin="0.5"
          placeholderMax="5"
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <Button variant="secondary" onClick={() => onChange({})}>
            Clear filters
          </Button>
          <Button variant="primary" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  );
}

interface ActiveFilterBadgesProps {
  spec: FilterSpec;
  onChange: (spec: FilterSpec) => void;
}

export function ActiveFilterBadges({ spec, onChange }: ActiveFilterBadgesProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    TagsRepo.getAll()
      .then(setTags)
      .catch(() => setTags([]));
  }, [spec.tagIds]);

  const update = (changes: Partial<FilterSpec>) => {
    onChange({ ...spec, ...changes });
  };

  const toggleArrayItem = <K extends "status" | "genres" | "platforms" | "tagIds">(
    key: K,
    val: string
  ) => {
    const current = (spec[key] as string[]) || [];
    if (current.includes(val)) {
      update({ [key]: current.filter((x) => x !== val) });
    } else {
      update({ [key]: [...current, val] });
    }
  };

  const clearAll = () => {
    onChange({});
  };

  const activeCount =
    (spec.status?.length || 0) +
    (spec.genres?.length || 0) +
    (spec.platforms?.length || 0) +
    (spec.tagIds?.length || 0) +
    (spec.releaseYear ? 1 : 0) +
    (spec.timeToBeat ? 1 : 0) +
    (spec.rating ? 1 : 0);

  if (activeCount === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {spec.status?.map((s) => (
        <Badge key={s} label={`Status: ${s}`} onRemove={() => toggleArrayItem("status", s)} />
      ))}
      {spec.genres?.map((g) => (
        <Badge key={g} label={`Genre: ${g}`} onRemove={() => toggleArrayItem("genres", g)} />
      ))}
      {spec.platforms?.map((p) => (
        <Badge key={p} label={`Platform: ${p}`} onRemove={() => toggleArrayItem("platforms", p)} />
      ))}
      {spec.tagIds?.map((tid) => {
        const t = tags.find((x) => x.id === tid);
        return (
          <Badge
            key={tid}
            label={`Tag: ${t?.name || tid}`}
            onRemove={() => toggleArrayItem("tagIds", tid)}
          />
        );
      })}
      {spec.releaseYear && (
        <Badge
          label={`Year: ${spec.releaseYear.min || "Any"}-${spec.releaseYear.max || "Any"}`}
          onRemove={() => update({ releaseYear: undefined })}
        />
      )}
      {spec.timeToBeat && (
        <Badge
          label={`Length: ${spec.timeToBeat.min || 0}h - ${spec.timeToBeat.max || "Any"}h`}
          onRemove={() => update({ timeToBeat: undefined })}
        />
      )}
      {spec.rating && (
        <Badge
          label={`Rating: ${spec.rating.min || 0} - ${spec.rating.max || 5}`}
          onRemove={() => update({ rating: undefined })}
        />
      )}

      <Button
        onClick={clearAll}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--app-secondary-label)",
          fontSize: "var(--font-size-sm)",
          cursor: "pointer",
          textDecoration: "underline",
          whiteSpace: "nowrap",
        }}
      >
        Clear all
      </Button>
    </div>
  );
}

function Badge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "var(--space-1) var(--space-2)",
        background: "var(--app-fill)",
        border: "1px solid var(--app-separator)",
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--font-size-sm)",
        color: "var(--app-label)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <Button
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--app-secondary-label)",
          cursor: "pointer",
          display: "flex",
          padding: 0,
        }}
      >
        <X size={12} aria-hidden="true" />
      </Button>
    </div>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="app-filter-group">
      <h4>{label}</h4>
      <div className="app-filter-group-grid">{children}</div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return <FluentCheckbox label={label} checked={checked} onChange={onChange} />;
}

function RangeFacet({
  label,
  min,
  max,
  onChange,
  placeholderMin,
  placeholderMax,
}: {
  label: string;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
  placeholderMin: string;
  placeholderMax: string;
}) {
  const lower = label === "Rating (stars)" ? 0.5 : label === "Release year" ? 1900 : 0;
  const upper = label === "Rating (stars)" ? 5 : label === "Release year" ? 2100 : undefined;
  const invalid =
    (min !== undefined &&
      (!Number.isFinite(min) || min < lower || (upper !== undefined && min > upper))) ||
    (max !== undefined &&
      (!Number.isFinite(max) || max < lower || (upper !== undefined && max > upper))) ||
    (min !== undefined && max !== undefined && min > max);
  return (
    <div>
      <h4
        style={{
          fontSize: "var(--font-size-sm)",
          fontWeight: 600,
          color: "var(--app-secondary-label)",
          marginBottom: "var(--space-2)",
        }}
      >
        {label}
      </h4>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TextInput
          type="number"
          placeholder={placeholderMin}
          value={min ?? ""}
          aria-label={`${label} minimum`}
          aria-invalid={invalid}
          min={lower}
          max={upper}
          step={label === "Rating (stars)" ? 0.5 : 1}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined, max)}
          style={{
            width: 80,
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--app-separator)",
            background: "var(--app-window-bg)",
            color: "var(--app-label)",
          }}
        />
        <span style={{ color: "var(--app-secondary-label)" }}>to</span>
        <TextInput
          type="number"
          placeholder={placeholderMax}
          value={max ?? ""}
          aria-label={`${label} maximum`}
          aria-invalid={invalid}
          min={lower}
          max={upper}
          step={label === "Rating (stars)" ? 0.5 : 1}
          onChange={(e) => onChange(min, e.target.value ? Number(e.target.value) : undefined)}
          style={{
            width: 80,
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--app-separator)",
            background: "var(--app-window-bg)",
            color: "var(--app-label)",
          }}
        />
      </div>
      {invalid && (
        <p className="library-filter-error" role="alert">
          Check the {label.toLowerCase()} range. Use valid values with minimum no greater than
          maximum.
        </p>
      )}
    </div>
  );
}
