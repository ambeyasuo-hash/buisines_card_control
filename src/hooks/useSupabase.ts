"use client";

import { useMemo } from "react";
import { createBYOClient } from "@/lib/supabase";
import { useBYOConfig } from "./useBYOConfig";

export function useSupabase() {
  const { config, isConfigured } = useBYOConfig();

  const client = useMemo(() => {
    if (!isConfigured) return null;
    return createBYOClient(config.supabaseUrl, config.supabaseAnonKey);
  }, [config.supabaseUrl, config.supabaseAnonKey, isConfigured]);

  return { client, isConfigured };
}
