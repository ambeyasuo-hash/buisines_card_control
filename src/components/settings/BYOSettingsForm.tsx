"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { useBYOConfig } from "@/hooks/useBYOConfig";
import type { BYOConfig } from "@/types";

type SaveStatus = "idle" | "saved" | "cleared";

export default function BYOSettingsForm() {
  const { config, save, clear, isConfigured, loaded } = useBYOConfig();

  const [draft, setDraft] = useState<BYOConfig>({
    supabaseUrl: "",
    supabaseAnonKey: "",
  });
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // localStorage 読み込み完了後にフォームを初期化
  useEffect(() => {
    if (loaded) setDraft(config);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(field: keyof BYOConfig, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setStatus("idle");
  }

  function handleSave() {
    save(draft);
    flash("saved");
  }

  function handleClear() {
    clear();
    setDraft({ supabaseUrl: "", supabaseAnonKey: "" });
    flash("cleared");
  }

  function flash(next: SaveStatus) {
    setStatus(next);
    setTimeout(() => setStatus("idle"), 2500);
  }

  if (!loaded) {
    return <div className="animate-pulse h-64 rounded-xl bg-black/5" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 接続状態バッジ */}
      <div className="flex items-center gap-2 text-sm">
        {isConfigured ? (
          <>
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-emerald-700 font-medium">接続情報が保存されています</span>
          </>
        ) : (
          <>
            <AlertCircle size={16} className="text-amber-500" />
            <span className="text-amber-700 font-medium">接続情報が未設定です</span>
          </>
        )}
      </div>

      {/* Supabase URL */}
      <Field label="Supabase URL" htmlFor="supabase-url" required>
        <input
          id="supabase-url"
          type="url"
          placeholder="https://xxxxxxxxxxxx.supabase.co"
          value={draft.supabaseUrl}
          onChange={(e) => handleChange("supabaseUrl", e.target.value)}
          className={inputClass}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      {/* Supabase Anon Key */}
      <Field label="Supabase Anon Key" htmlFor="anon-key" required>
        <div className="relative">
          <input
            id="anon-key"
            type={showAnonKey ? "text" : "password"}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            value={draft.supabaseAnonKey}
            onChange={(e) => handleChange("supabaseAnonKey", e.target.value)}
            className={`${inputClass} pr-10`}
            autoComplete="off"
            spellCheck={false}
          />
          <ToggleVisibility show={showAnonKey} onToggle={() => setShowAnonKey((v) => !v)} />
        </div>
      </Field>

      {/* アクション */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!draft.supabaseUrl || !draft.supabaseAnonKey}
          className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Save size={15} />
          保存する
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-black/60 transition-colors hover:border-red-300 hover:text-red-600"
        >
          <Trash2 size={15} />
          クリア
        </button>

        {/* フラッシュメッセージ */}
        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 animate-in fade-in duration-200">
            <CheckCircle size={14} />
            保存しました
          </span>
        )}
        {status === "cleared" && (
          <span className="flex items-center gap-1.5 text-sm text-black/50 animate-in fade-in duration-200">
            クリアしました
          </span>
        )}
      </div>

      {/* 注記 */}
      <p className="text-xs text-black/35 border-t border-black/8 pt-4">
        入力した情報はこのブラウザの localStorage にのみ保存されます。サーバーには送信されません。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 小コンポーネント
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-black/12 bg-white px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-black/25 focus:border-black/25 focus:ring-3 focus:ring-black/8";

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-black/75">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleVisibility({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-black/30 hover:text-black/60"
      aria-label={show ? "非表示にする" : "表示する"}
    >
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );
}
