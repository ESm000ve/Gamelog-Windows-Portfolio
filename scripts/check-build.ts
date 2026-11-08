import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = path.resolve("dist");
async function asset(file: string) {
  const target = path.resolve(root, file);
  assert.ok(target.startsWith(root + path.sep), "Asset must stay inside dist: " + file);
  assert.ok((await stat(target)).isFile(), "Missing production asset: " + file);
  return target;
}
const html = await readFile(path.join(root, "index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = new URL(match[1], "http://gamelog.local/game/42");
  if (url.origin !== "http://gamelog.local") continue;
  await asset("." + url.pathname);
}
interface Chunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
}
const manifest: Record<string, Chunk> = JSON.parse(
  await readFile(path.join(root, ".vite/manifest.json"), "utf8")
);
const initial = new Set<string>();
function include(key: string) {
  const chunk = manifest[key];
  assert.ok(chunk, "Missing imported manifest chunk: " + key);
  if (initial.has(chunk.file)) return;
  initial.add(chunk.file);
  for (const dependency of chunk.imports ?? []) include(dependency);
}
for (const [key, chunk] of Object.entries(manifest)) {
  await asset(chunk.file);
  for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) await asset(file);
  for (const dependency of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])])
    assert.ok(manifest[dependency], "Broken chunk dependency: " + dependency);
  if (chunk.isEntry) include(key);
}
const total = [...new Set(Object.values(manifest).map((chunk) => chunk.file))].filter((file) =>
  file.endsWith(".js")
);
async function bytes(files: string[]) {
  let raw = 0,
    gzip = 0;
  for (const file of files) {
    const content = await readFile(await asset(file));
    raw += content.length;
    gzip += gzipSync(content).length;
  }
  return { bytes: raw, gzipBytes: gzip, files: files.length };
}
console.log(
  "Production HTML, static and lazy chunk dependencies resolve correctly from nested routes."
);
console.log(
  JSON.stringify({
    initialJavaScript: await bytes([...initial].filter((file) => file.endsWith(".js"))),
    totalJavaScript: await bytes(total),
  })
);
