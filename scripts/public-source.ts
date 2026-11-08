import { readdir, readFile, mkdir, copyFile, lstat } from "node:fs/promises";
import path from "node:path";

// Explicit publication boundaries: local archives, credentials, dependencies,
// installers and the original Git history can never enter the export.
const directories = [
  "src",
  "server",
  "electron",
  "scripts",
  "tests",
  "public",
  "docs",
  "examples",
  ".github",
];
const rootFiles = [
  "README.md",
  "ATTRIBUTIONS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".env.example",
  ".gitignore",
  ".prettierrc",
  "package.json",
  "package-lock.json",
  "index.html",
  "playwright.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "build/icon.svg",
];
const root = process.cwd();
const files = [...rootFiles];
async function walk(directory: string) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Publication cannot include symlinks: ${relative}`);
    if (entry.isDirectory()) await walk(relative);
    else files.push(relative);
  }
}
for (const directory of directories) await walk(directory);
const findings: string[] = [];
for (const file of files) {
  const segments = file.toLowerCase().split("/");
  if ((await lstat(path.join(root, file))).isSymbolicLink())
    findings.push(`Publication cannot include symlinks: ${file}`);
  if (
    (file !== ".env.example" &&
      segments.some((part) => part === ".env" || part.startsWith(".env."))) ||
    segments.some((part) =>
      [".git", "node_modules", ".local-only", ".agents", ".claude", ".codex"].includes(part)
    ) ||
    /^gamelog-backup-.*\.json$/i.test(path.basename(file)) ||
    /\.(pem|key|p12|pfx|db|sqlite|zip|exe|asar)$/i.test(file)
  )
    findings.push(`Private or generated file: ${file}`);
  const content = await readFile(path.join(root, file));
  if (/\.(png|jpe?g|webp|ico|woff2?)$/i.test(file)) continue;
  const value = content.toString("utf8");
  for (const [label, rule] of [
    ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
    ["GitHub token", /(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})/],
    ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["Credential value", /(?:CLIENT_SECRET|API_KEY)\s*[:=]\s*["']?[a-zA-Z0-9_-]{24,}/],
    ["Personal machine path", /(?:[C-F]:\\Users\\|\/Users\/|\/home\/)[a-zA-Z0-9_.-]+/],
  ] as const) {
    if (rule.test(value)) findings.push(`${label}: ${file}`);
  }
}
if (findings.length) throw new Error(findings.join("\n"));
console.log(
  `Publication scan passed: ${files.length} files. No recognized credentials or private file types.`
);
console.log(
  "Pattern scanning cannot prove that every possible secret is absent. Review new content before publishing."
);
if (process.argv.includes("--export")) {
  const destination = path.join(root, "release", "github-source");
  await mkdir(path.dirname(destination), { recursive: true });
  // Refuse to overlay an earlier export: stale files must never survive unnoticed.
  await mkdir(destination, { recursive: false });
  for (const file of files) {
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, file), target);
  }
  console.log(
    `Clean source exported to ${destination}. No .git history or local configuration included.`
  );
}
