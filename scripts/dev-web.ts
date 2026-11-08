process.env.GAMELOG_WEB_ONLY = "1";
const { createServer } = await import("vite");
const server = await createServer();
await server.listen();
server.printUrls();
