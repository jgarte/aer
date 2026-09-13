# USD to ALL API

One public Supabase Edge Function returning the latest published official USD
exchange rate from the [Bank of Albania](https://www.bankofalbania.org/Markets/Official_exchange_rate/).
No database is used for rate data. The latest valid rate is persisted in a
private Supabase Storage bucket.

## Deploy

With the Supabase CLI installed, run from this directory, replacing
`YOUR_PROJECT_REF` with your existing Supabase project's reference:

```sh
supabase login
supabase functions deploy usd-all --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` sets `verify_jwt = false`, so callers need no API key or
Authorization header. See [Supabase function configuration](https://supabase.com/docs/guides/functions/function-configuration).

The function uses a private Supabase Storage bucket named `rate-cache`. Apply
the bucket migration before deploying a fresh project:

```sh
supabase db push --project-ref YOUR_PROJECT_REF
supabase functions deploy usd-all --project-ref YOUR_PROJECT_REF
```

Run the isolated handler tests with:

```sh
deno test supabase/functions/usd-all/handler_test.ts
```

The tests use mocked source and Storage dependencies, so they do not modify
the deployed function or production cache.

To scaffold an equivalent project from an empty directory, use the commands below,
then replace the generated function with `supabase/functions/usd-all/index.ts`
from this repository and add `[functions.usd-all]` with `verify_jwt = false` to the
generated `supabase/config.toml`. These scaffold commands are unnecessary here:

```sh
supabase init
supabase functions new usd-all
```

## Test the deployed endpoint

```sh
curl -i 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/usd-all'
```

Example response (the rate changes with the source):

```json
{"baseCurrency":"USD","quoteCurrency":"ALL","quotePerBase":79.29,"source":"Bank of Albania","retrievedAt":"2026-09-13T19:41:08.334Z"}
```

## Parsing and responses

The live HTML was inspected on 2026-09-13. Cheerio's slim entry point parses the
table whose first `thead th` is `Main Currency`. Within that table, the second
`td` must equal `USD`. The third cell is the official rate; the fourth is the
daily change. The separate bid/ask table is excluded. The parser requires exactly
one matching table and row, five cells, and a finite positive decimal rate.
If the website changes its structure, the selector may need updating.

The value is already ALL per USD, so no inversion or conversion is performed.
"Current" means the latest published official rate, including on weekends.

The function reads `rate-cache/usd-all/latest.json` before calling the source.
Snapshots less than one hour old are returned directly. After one hour, the
function fetches a fresh rate and overwrites the snapshot. If the source or
parser fails, the latest valid snapshot is returned with `stale: true`; if no
snapshot exists, the function returns 502.

Upstream HTTP/network failures, a 10-second fetch timeout, and unreadable response
bodies return 502. Missing or invalid rate data also returns 502. Unexpected
internal failures return 500. All responses are JSON. Successful responses set
`Cache-Control: public, max-age=3600`; errors use `no-store`. The cache header
allows HTTP caching but does not create a server-side cache.
