import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key — bypasses RLS,
 * so this must never be imported into a "use client" component or
 * exposed to the browser. Used by the upload API route to write into
 * the "songs" storage bucket.
 *
 * Created lazily on first use rather than at import time, so `next build`
 * (which imports every route module to collect page data) doesn't need
 * Supabase credentials.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const SONGS_BUCKET = "songs";
