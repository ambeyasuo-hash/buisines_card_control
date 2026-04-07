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

  return <SettingsClient schemaSql={schemaSql} />;
}
