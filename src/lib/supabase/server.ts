import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { prefixTable } from "./table-prefix";

/**
 * Server-side Supabase client (Server Components, Route Handlers).
 * Uses cookie-based session with RLS.
 * Table names are auto-prefixed via Proxy.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const client = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if middleware refreshes sessions.
        }
      },
    },
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tableName: string) => target.from(prefixTable(tableName));
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  }) as typeof client;
}

/**
 * Admin/service-role client for cron jobs and admin operations.
 * Bypasses RLS. Use ONLY on the server side.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey || serviceKey === "PLACEHOLDER_NEED_USER_INPUT") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  // Use createClient directly (not SSR) for service-role
  const client = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tableName: string) => target.from(prefixTable(tableName));
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  }) as typeof client;
}
