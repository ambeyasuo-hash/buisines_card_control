// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useState, useEffect, useCallback } from "react";
import type { BYOConfig } from "@/types";
import { getBYOConfig, setBYOConfig, clearBYOConfig } from "@/lib/utils";
import { getSession, fetchUserSettings, signOut as supabaseSignOut, performHealthCheck } from "@/lib/supabase";

const EMPTY: BYOConfig = { supabaseUrl: "", supabaseAnonKey: "", geminiApiKey: "" };

export function useBYOConfig() {
  const [config, setConfig] = useState<BYOConfig>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const stored = getBYOConfig();
      setConfig(stored);

      // Supabase Auth セッション確認
      if (stored.supabaseUrl && stored.supabaseAnonKey) {
        const session = await getSession();
        if (session) {
          setLoggedIn(true);
          setUserEmail(session.user.email ?? null);

          // DB から Gemini Key を同期（DB優先）
          const settings = await fetchUserSettings();
          if (settings?.gemini_api_key) {
            const synced: BYOConfig = { ...stored, geminiApiKey: settings.gemini_api_key };
            setBYOConfig(synced);
            setConfig(synced);
          }

          // Health Check: Supabase 無料プランのスリープ防止（非同期、ノーウェイト）
          performHealthCheck().catch(() => {
            // サイレント: エラーは無視
          });
        }
      }

      setLoaded(true);
    }

    init();
  }, []);

  const save = useCallback((next: BYOConfig) => {
    setBYOConfig(next);
    setConfig(next);
  }, []);

  const clear = useCallback(() => {
    clearBYOConfig();
    setConfig(EMPTY);
  }, []);

  const logout = useCallback(async () => {
    await supabaseSignOut();
    setLoggedIn(false);
    setUserEmail(null);
    // Gemini Key は localStorage から消去（セキュリティ）
    const current = getBYOConfig();
    const next: BYOConfig = { ...current, geminiApiKey: "" };
    setBYOConfig(next);
    setConfig(next);
  }, []);

  const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const isReady = isConfigured && loggedIn && Boolean(config.geminiApiKey);

  return { config, save, clear, isConfigured, isReady, loaded, loggedIn, userEmail, logout };
}
