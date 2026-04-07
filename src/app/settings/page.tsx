// (c) 2026 ambe / Business_Card_Folder

import { readFile } from "fs/promises";
import path from "path";
import SettingsClient from "./settings-client";

async function loadSchemaSql(): Promise<string> {
  try {
    const p = path.join(process.cwd(), "supabase_schema.sql");
    return await readFile(p, "utf8");
  } catch {
    return "-- supabase_schema.sql が見つかりませんでした。\n";
  }
}

export default async function SettingsPage() {
  const schemaSql = await loadSchemaSql();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">接続設定</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Supabase / Gemini のキーは BYO 方式で、このブラウザの localStorage に保存されます。
      </p>

      <SettingsClient schemaSql={schemaSql} />
    </div>
  );
}
