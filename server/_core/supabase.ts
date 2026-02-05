
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase credentials in environment variables.");
}

// Create a single supabase client for interacting with your database
// Valid URL required to prevent crash. Handle placeholders like "<OPTIONAL>"
const isValidUrl = (url?: string) => url && url.startsWith("http") && !url.includes("OPTIONAL");
const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl! : "https://example.com";
const finalKey = supabaseKey && !supabaseKey.includes("OPTIONAL") ? supabaseKey : "placeholder-key";

export const supabase = createClient(finalUrl, finalKey);
