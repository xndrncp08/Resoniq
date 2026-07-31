import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key — bypasses RLS,
 * so this must never be imported into a "use client" component or
 * exposed to the browser. Used by the upload API route to write into
 * the "songs" storage bucket.
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const SONGS_BUCKET = "songs";