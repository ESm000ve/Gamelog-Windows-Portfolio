import type { Game, Log, UserList, Tag } from "./index";
export interface ListMembership {
  listId: string;
  index: number;
  before?: number;
  after?: number;
}
interface RemovedBase {
  id: string;
  label: string;
  removedAt: number;
}
export type RecoveryEntry = RemovedBase &
  (
    | { kind: "game"; game: Game; log?: Log; tags: Tag[]; memberships: ListMembership[] }
    | {
        kind: "sessions";
        gameId: number;
        logCreatedAt: number;
        before: NonNullable<Log["playSessions"]>;
        after: NonNullable<Log["playSessions"]>;
      }
    | { kind: "list"; list: UserList }
    | { kind: "list-item"; gameId: number; listName: string; membership: ListMembership }
    | { kind: "library"; games: Game[]; logs: Log[]; lists: UserList[]; tags: Tag[] }
  );
