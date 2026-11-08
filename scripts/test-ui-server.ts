// A dedicated origin keeps browser-test storage separate from the running app.
process.env.GAMELOG_WEB_ONLY = "1";
if (process.env.GAMELOG_TEST_PRODUCTION === "1") {
  const { createServerApp } = await import("../server/app.ts");
  createServerApp("dist").listen(5181, "127.0.0.1", () =>
    console.log("Production test app: http://127.0.0.1:5181")
  );
} else {
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 5181, strictPort: true },
  });
  await server.listen();
  server.printUrls();
}
