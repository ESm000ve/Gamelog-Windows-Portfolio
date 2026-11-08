import { spawn } from "node:child_process";
import path from "node:path";
const child = spawn(
  process.execPath,
  [path.resolve("node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, GAMELOG_TEST_PRODUCTION: "1" },
  }
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
