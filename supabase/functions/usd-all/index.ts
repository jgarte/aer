import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createUsdAllHandler,
  isRateSnapshot,
  type RateCache,
  type RateSnapshot,
} from "./handler.ts";

const CACHE_BUCKET = "rate-cache";
const CACHE_PATH = "usd-all/latest.json";

function createStorageClient() {
  const url = Deno.env.get("SUPABASE_URL");
  let secretKey: string | undefined;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed.default === "string") {
        secretKey = parsed.default;
      }
    } catch {
      console.error("Could not parse SUPABASE_SECRET_KEYS");
    }
  }

  secretKey ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? undefined;

  if (!url || !secretKey) {
    console.error("Supabase Storage is not configured");
    return null;
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createStorageCache(): RateCache {
  const storage = createStorageClient();

  return {
    async read(): Promise<RateSnapshot | null> {
      if (!storage) return null;

      try {
        const { data, error } = await storage.storage
          .from(CACHE_BUCKET)
          .download(CACHE_PATH);

        if (error || !data) return null;

        const value: unknown = JSON.parse(await data.text());
        return isRateSnapshot(value) ? value : null;
      } catch (error) {
        console.error("Could not read cached USD rate", error);
        return null;
      }
    },

    async write(snapshot: RateSnapshot): Promise<void> {
      if (!storage) return;

      try {
        const { error } = await storage.storage
          .from(CACHE_BUCKET)
          .upload(CACHE_PATH, JSON.stringify(snapshot), {
            contentType: "application/json",
            cacheControl: "0",
            upsert: true,
          });

        if (error) {
          console.error("Could not write cached USD rate", error);
        }
      } catch (error) {
        console.error("Could not write cached USD rate", error);
      }
    },
  };
}

const handler = createUsdAllHandler({
  fetchFn: (input, init) => fetch(input, init),
  cache: createStorageCache(),
});

Deno.serve(handler);
