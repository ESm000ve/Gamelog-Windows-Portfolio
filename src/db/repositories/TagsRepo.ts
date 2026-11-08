import { db } from "../schema";
import type { Tag } from "../../types";

export const TagsRepo = {
  async getAll(): Promise<Tag[]> {
    return db.tags.orderBy("name").toArray();
  },

  async getOrCreate(name: string): Promise<Tag> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Tag name cannot be empty");

    // Case-insensitive lookup
    const allTags = await db.tags.toArray();
    let tag = allTags.find((t) => t.name.toLowerCase() === trimmedName.toLowerCase());

    if (!tag) {
      tag = {
        id: crypto.randomUUID(),
        name: trimmedName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.tags.put(tag);
    }

    return tag;
  },
};
