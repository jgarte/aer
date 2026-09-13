import { load } from "npm:cheerio@1.0.0/slim";

const SOURCE_URL =
  "https://www.bankofalbania.org/Markets/Official_exchange_rate/";

type UsdAllResponse =
  | {
      base: "USD";
      quote: "ALL";
      rate: number;
      source: "Bank of Albania";
    }
  | {
      error: string;
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

Deno.serve(async () => {
  try {
    let html: string;
    try {
      const response = await fetch(SOURCE_URL, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return json({ error: "Bank of Albania request failed" }, 502);
      }
      html = await response.text();
    } catch {
      return json({ error: "Bank of Albania request failed" }, 502);
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
      return json({ error: "Could not parse the official USD rate" }, 502);
    }

    return json({ base: "USD", quote: "ALL", rate, source: "Bank of Albania" });
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});
