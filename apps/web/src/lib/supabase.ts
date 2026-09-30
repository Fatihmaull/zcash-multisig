import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Optional. Pages read Prisma first and only fall back here.
 * A missing publishable key must not throw at import — that breaks `next build`
 * on a machine that has no Supabase project.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
