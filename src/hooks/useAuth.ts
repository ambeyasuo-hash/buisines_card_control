// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { getDynamicSupabase, signOut as supabaseSignOut } from "@/lib/supabase";

/**
 * Supabase Auth セッションを監視するフック。
 * BYO設定（Supabase URL/Key）がない場合は isLoggedIn=false を返す。
 *
 * NOTE: Supabase URL/Keyを変更した場合はページをリロードすること。
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getDynamicSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 初期セッション取得
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Auth状態の変更を購読
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setUser(null);
  }, []);

  return { user, isLoggedIn: !!user, loading, signOut };
}
