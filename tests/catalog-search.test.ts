import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/catalog/IgdbCatalog";
test("search keeps usable results when an involved company is missing", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json([
      {
        id: 710001,
        name: "Sparse Search Game",
        slug: "sparse",
        involved_companies: [{ developer: true }, { publisher: true, company: null }],
      },
      {
        id: 710002,
        name: "Complete Search Game",
        slug: "complete",
        involved_companies: [
          { developer: true, publisher: true, company: { name: "Fixture Studio" } },
        ],
      },
    ]);
  try {
    const results = await catalog.search("sparse company regression fixture");
    assert.equal(results.length, 2);
    assert.equal(results[0].developer, "Unknown");
    assert.equal(results[0].publisher, undefined);
    assert.equal(results[1].developer, "Fixture Studio");
  } finally {
    globalThis.fetch = previous;
  }
});
