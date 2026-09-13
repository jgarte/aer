import { deepStrictEqual, strictEqual } from "node:assert/strict";
import {
  createUsdAllHandler,
  type RateCache,
  type RateSnapshot,
} from "./handler.ts";

const snapshot: RateSnapshot = {
  baseCurrency: "USD",
  quoteCurrency: "ALL",
  quotePerBase: 79.29,
  source: "Bank of Albania",
  retrievedAt: "2026-09-13T18:00:00.000Z",
};

const sourceHtml = `
  <table>
    <thead><tr><th>Main Currency</th></tr></thead>
    <tbody>
      <tr><td>United States Dollar</td><td>USD</td><td>79.31</td><td>0.02</td><td>up</td></tr>
    </tbody>
  </table>
`;

function request(): Request {
  return new Request("https://example.test/usd-all");
}

Deno.test("returns a fresh Storage snapshot without calling the source", async () => {
  let fetchCalls = 0;
  let writes = 0;
  const cache: RateCache = {
    read: async () => snapshot,
    write: async () => {
      writes++;
    },
  };
  const handler = createUsdAllHandler({
    fetchFn: async () => {
      fetchCalls++;
      return new Response(sourceHtml);
    },
    cache,
    now: () => new Date("2026-09-13T18:30:00.000Z"),
  });

  const response = await handler(request());

  strictEqual(response.status, 200);
  deepStrictEqual(await response.json(), snapshot);
  strictEqual(fetchCalls, 0);
  strictEqual(writes, 0);
});

Deno.test("refreshes an expired snapshot and writes the new rate", async () => {
  let written: RateSnapshot | null = null;
  const cache: RateCache = {
    read: async () => snapshot,
    write: async (value) => {
      written = value;
    },
  };
  const now = new Date("2026-09-13T19:01:00.000Z");
  const handler = createUsdAllHandler({
    fetchFn: async () => new Response(sourceHtml),
    cache,
    now: () => now,
  });

  const response = await handler(request());
  const body = await response.json();

  strictEqual(response.status, 200);
  strictEqual(body.quotePerBase, 79.31);
  strictEqual(body.retrievedAt, now.toISOString());
  deepStrictEqual(written, body);
});

Deno.test("serves a stale snapshot when the source fails", async () => {
  const cache: RateCache = {
    read: async () => snapshot,
    write: async () => {},
  };
  const handler = createUsdAllHandler({
    fetchFn: async () => {
      throw new Error("source unavailable");
    },
    cache,
    now: () => new Date("2026-09-13T20:00:00.000Z"),
  });

  const response = await handler(request());

  strictEqual(response.status, 200);
  deepStrictEqual(await response.json(), { ...snapshot, stale: true });
});

Deno.test("returns 502 when the source fails and no snapshot exists", async () => {
  const cache: RateCache = {
    read: async () => null,
    write: async () => {},
  };
  const handler = createUsdAllHandler({
    fetchFn: async () => {
      throw new Error("source unavailable");
    },
    cache,
  });

  const response = await handler(request());

  strictEqual(response.status, 502);
  deepStrictEqual(await response.json(), {
    error: "Bank of Albania request failed",
  });
});

Deno.test("returns the live rate when writing the cache fails", async () => {
  const cache: RateCache = {
    read: async () => null,
    write: async () => {
      throw new Error("storage unavailable");
    },
  };
  const now = new Date("2026-09-13T19:01:00.000Z");
  const handler = createUsdAllHandler({
    fetchFn: async () => new Response(sourceHtml),
    cache,
    now: () => now,
  });

  const response = await handler(request());
  const body = await response.json();

  strictEqual(response.status, 200);
  strictEqual(body.quotePerBase, 79.31);
  strictEqual(body.retrievedAt, now.toISOString());
});
