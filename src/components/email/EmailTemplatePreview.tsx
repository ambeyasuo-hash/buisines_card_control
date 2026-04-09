// (c) 2026 ambe / Business_Card_Folder
// Email Template Preview Component - Phase 3/4

"use client";

import { useCallback, useState } from "react";
import type { GeneratedEmail } from "@/types/business-card";

export function EmailTemplatePreview({
  template,
  onApprove,
  onCancel,
  loading,
}: {
  template: GeneratedEmail;
  onApprove: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="border border-white/10 rounded-xl bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">生成されたテンプレート</h4>
        <p className="text-xs text-slate-400">
          プレースホルダー: {template.variables.join(", ")}
        </p>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400">件名</p>
          <p className="font-mono text-sm text-white break-words">
            {template.subject}
          </p>
        </div>

        <div className="border-t border-white/10 pt-2 space-y-1">
          <p className="text-xs font-semibold text-slate-400">本文</p>
          <p className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed break-words">
            {template.body}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        ⓘ このテンプレートは AI により生成されました。内容を確認してから承認してください。
      </p>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition"
        >
          {loading ? "入力中..." : "実データで入力"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 h-9 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

export function EmailHydratedPreview({
  email,
  mailto,
  onReset,
}: {
  email: { subject: string; body: string };
  mailto: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = useCallback(async () => {
    const text = `件名: ${email.subject}\n\n${email.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [email]);

  const handleOpenMail = useCallback(() => {
    window.location.href = mailto;
  }, [mailto]);

  return (
    <div className="border border-green-500/30 rounded-xl bg-green-950/20 p-4 space-y-3">
      <h4 className="font-semibold text-sm text-green-200">完成したメール</h4>

      <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400">件名</p>
          <p className="font-mono text-sm text-white break-words">
            {email.subject}
          </p>
        </div>

        <div className="border-t border-white/10 pt-2 space-y-1">
          <p className="text-xs font-semibold text-slate-400">本文</p>
          <p className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed break-words">
            {email.body}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleCopyToClipboard}
          className="flex-1 min-w-fit h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition flex items-center justify-center gap-2"
        >
          {copied ? "✓ コピー完了" : "📋 コピー"}
        </button>
        <button
          onClick={handleOpenMail}
          className="flex-1 min-w-fit h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition flex items-center justify-center gap-2"
        >
          ✉️ メーラーで開く
        </button>
        <button
          onClick={onReset}
          className="flex-1 min-w-fit h-9 rounded-lg border border-white/10 hover:bg-white/5 text-white text-sm font-medium transition"
        >
          新しく生成
        </button>
      </div>
    </div>
  );
}

export function EmailGenerationError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="border border-red-500/30 rounded-xl bg-red-950/20 p-4 space-y-3">
      <p className="text-sm text-red-200">エラー: {message}</p>
      <button
        onClick={onRetry}
        className="w-full h-9 rounded-lg border border-red-500/30 hover:bg-red-950/40 text-red-200 text-sm font-medium transition"
      >
        もう一度試す
      </button>
    </div>
  );
}
