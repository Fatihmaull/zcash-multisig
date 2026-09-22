import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bxtscgxyzlbtkyymdcfx.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_R8CXF5EZC9aJU_e_hhHXtA_PmvdHOU4";

/**
 * Global Supabase Client instance for Quorum
 * Can be used for cloud synchronization, real-time signer coordination events, or storage.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);
