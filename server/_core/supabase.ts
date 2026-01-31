
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase credentials in environment variables.");
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl || "", supabaseKey || "");
