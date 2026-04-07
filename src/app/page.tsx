"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBYOConfig } from "@/lib/utils";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const config = getBYOConfig();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      router.replace("/cards");
    } else {
      router.replace("/settings");
    }
  }, [router]);

  return null;
}
