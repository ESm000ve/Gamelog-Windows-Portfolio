/**
 * catalog/index.ts — single stable import path for catalog access.
 *
 * Every module that needs to search or fetch game metadata imports from here:
 *   import { catalog } from "../catalog";
 *
 * To switch to a different catalog backend, only this file changes.
 */
export { catalog } from "./IgdbCatalog";
export type { ICatalogSource, CatalogGame } from "./types";
