/**
 * Minimal request/response shape shared by our route handlers.
 *
 * These handlers are attached to two different servers depending on context:
 *  - Vite's dev middleware stack (`server.middlewares`, a Connect instance) — see
 *    the `configureServer` hooks in ai.ts / igdb.ts / steam.ts.
 *  - A real Express app (`electron/main.ts`, used in the packaged Electron build).
 *
 * The handlers here only ever touch the properties below, which both Connect's
 * augmented `IncomingMessage`/`ServerResponse` and Express's `Request`/`Response`
 * satisfy structurally — so a small shared interface avoids depending on either
 * library's types directly while still getting real type-checking.
 */
export interface MinimalRequest {
  on(event: "error" | "aborted", listener: (error?: Error) => void): void;
  method?: string;
  originalUrl?: string;
  on(event: "data" | "end", listener: (chunk: Buffer) => void): void;
}

export interface MinimalResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}
