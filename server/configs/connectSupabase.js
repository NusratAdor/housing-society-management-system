// server/configs/connectSupabase.js
//
// Same pattern as configs/cloudinary.js — validates required env vars,
// then creates and exports a configured client.

import { createClient } from "@supabase/supabase-js";

const connectSupabase = () => {
  const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  console.log("✅ Supabase Connected");

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export const supabase = connectSupabase();
export default connectSupabase;