import { load } from "npm:cheerio@1.0.0/slim";

const SOURCE_URL =
  "https://www.bankofalbania.org/Markets/Official_exchange_rate/";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

export type UsdAllRate = {
  base: "USD";
  quote: "ALL";
  rate: number;
  source: "Bank of Albania";
};

export type RateSnapshot = UsdAllRate & {
  fetchedAt: string;
};

export type UsdAllResponse =
  | (RateSnapshot & { stale?: true })
  | {
      error: string;
    };

export type RateCache = {
  read(): Promise<RateSnapshot | null>;
  write(snapshot: RateSnapshot): Promise<void>;
};

export type HandlerDependencies = {
  fetchFn: typeof fetch;
  cache: RateCache;
  now?: () => Date;
};

function json(body: UsdAllResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "public, max-age=3600" : "no-store",
    },
  });
}

export function isRateSnapshot(value: unknown): value is RateSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<RateSnapshot>;
  return snapshot.base === "USD" &&
    snapshot.quote === "ALL" &&
    typeof snapshot.rate === "number" &&
    Number.isFinite(snapshot.rate) &&
    snapshot.rate > 0 &&
    snapshot.source === "Bank of Albania" &&
    typeof snapshot.fetchedAt === "string" &&
    Number.isFinite(Date.parse(snapshot.fetchedAt));
}

function isFresh(snapshot: RateSnapshot, now: Date): boolean {
  return now.getTime() - Date.parse(snapshot.fetchedAt) < CACHE_MAX_AGE_MS;
}

export function createUsdAllHandler({
  fetchFn,
  cache,
  now = () => new Date(),
}: HandlerDependencies) {
  async function cachedOrError(message: string): Promise<Response> {
    const cached = await cache.read();
    if (cached) return json({ ...cached, stale: true });
    return json({ error: message }, 502);
  }

  return async (_request: Request): Promise<Response> => {
    try {
      const cached = await cache.read();
      if (cached && isFresh(cached, now())) return json(cached);

      let html: string;
      try {
        const response = await fetchFn(SOURCE_URL, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          return cachedOrError("Bank of Albania request failed");
        }
        html = await response.text();
      } catch {
        return cachedOrError("Bank of Albania request failed");
      }

      const $ = load(html);
      // Only the official-rate table has the "Main Currency" header.
      const table = $("table").filter((_, element) =>
        $(element).find("thead th").first().text().trim() === "Main Currency"
      );
      const row = table.find("tr").filter((_, element) =>
        $(element).children("td").eq(1).text().trim() === "USD"
      );
      // Live columns: currency name, code, official rate, change, arrow.
      const cells = row.children("td");
      const value = cells.eq(2).text().trim();
      const rate = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;

      if (
        table.length !== 1 || row.length !== 1 || cells.length !== 5 ||
        !Number.isFinite(rate) || rate <= 0
      ) {
        return cachedOrError("Could not parse the official USD rate");
      }

      const snapshot: RateSnapshot = {
        base: "USD",
        quote: "ALL",
        rate,
        source: "Bank of Albania",
        fetchedAt: now().toISOString(),
      };

      try {
        await cache.write(snapshot);
      } catch (error) {
        console.error("Could not write cached USD rate", error);
      }

      return json(snapshot);
    } catch {
      return cachedOrError("Internal server error");
    }
  };
}
