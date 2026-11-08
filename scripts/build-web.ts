process.env.GAMELOG_WEB_ONLY = "1";
const { build } = await import("vite");
await build();
