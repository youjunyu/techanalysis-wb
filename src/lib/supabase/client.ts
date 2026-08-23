import { createBrowserClient } from "@supabase/ssr";
import { prefixTable } from "./table-prefix";

/**
 * Client-side Supabase client (browser).
 * Uses publishable/anon key with RLS.
 * Table names are auto-prefixed via Proxy.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const client = createBrowserClient(supabaseUrl, supabaseKey);

  // Proxy: auto-prefix all .from() calls
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tableName: string) => {
          return target.from(prefixTable(tableName));
        };
      }
      // Pass through auth, storage, channel, etc.
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  }) as typeof client;
}
