"use client";

import { useState, useEffect, useCallback } from "react";
import type { BYOConfig } from "@/types";
import { getBYOConfig, setBYOConfig, clearBYOConfig } from "@/lib/utils";

const EMPTY: BYOConfig = { supabaseUrl: "", supabaseAnonKey: "", geminiApiKey: "" };

export function useBYOConfig() {
  const [config, setConfig] = useState<BYOConfig>(EMPTY);
  // localStorage は SSR では読めないため、マウント後に読み込む
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConfig(getBYOConfig());
    setLoaded(true);
  }, []);

  const save = useCallback((next: BYOConfig) => {
    setBYOConfig(next);
    setConfig(next);
  }, []);

  const clear = useCallback(() => {
    clearBYOConfig();
    setConfig(EMPTY);
  }, []);

  const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

  return { config, save, clear, isConfigured, loaded };
}
