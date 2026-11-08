/**
 * db/index.ts — re-exports the singleton from schema.ts.
 *
 * All consumers import `db` from here, so this file is the single
 * stable import path even as the schema file evolves.
 */
export { db, GamelogDB } from "./schema";
export * from "./repositories";
