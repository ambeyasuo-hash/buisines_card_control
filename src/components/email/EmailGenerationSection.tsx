// (c) 2026 ambe / Business_Card_Folder
// Email Generation Section Component - Phase 3/4 Integration

"use client";

import { useCallback, useMemo } from "react";
import { usePhase3EmailGeneration } from "@/hooks/usePhase3EmailGeneration";
import { EmailTemplatePreview, EmailHydratedPreview, EmailGenerationError } from "./EmailTemplatePreview";
import type { BusinessCardData } from "@/types/business-card";

export interface EmailGenerationSectionProps {
  cardData: BusinessCardData;
  currentUserData?: {
    full_name?: string;
    title?: string;
    company?: string;
  };
}

export function EmailGenerationSection({
  cardData,
  currentUserData,
}: EmailGenerationSectionProps) {
  const { status, onGenerateTemplate, onHydrateTemplate, onReset } =
    usePhase3EmailGeneration({ cardData, currentUserData });

  const isEmpty =
    !cardData.full_name?.trim() ||
    !cardData.email?.trim() ||
    !cardData.company?.trim();

  const handleGenerateClick = useCallback(() => {
    if (isEmpty) {
      return; // Validation message shown in UI
    }
    onGenerateTemplate();
  }, [isEmpty, onGenerateTemplate]);

  const isLoading = useMemo(
    () =>
      status.state === "generating" || status.state === "hydrating",
    [status.state]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">メール生成（Phase 3）</h3>
        <span className="text-xs bg-blue-600/30 text-blue-200 px-2 py-1 rounded">
          ゼロ知識メール
        </span>
      </div>

      {isEmpty && (
        <div className="border border-yellow-500/30 rounded-xl bg-yellow-950/20 p-3">
          <p className="text-sm text-yellow-200">
            ⚠️ 氏名、メール、会社を入力してからメール生成できます
          </p>
        </div>
      )}

      {status.state === "idle" && (
        <button
          onClick={handleGenerateClick}
          disabled={isEmpty || isLoading}
          className="w-full h-10 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition flex items-center justify-center gap-2"
        >
          🤖 AI でメールテンプレートを生成
        </button>
      )}

      {status.state === "generating" && (
        <div className="border border-white/10 rounded-xl bg-white/5 p-4 space-y-3">
          <p className="text-sm text-slate-300 animate-pulse">
            🔄 AI がメールテンプレートを生成中...
          </p>
          <p className="text-xs text-slate-500">
            ⓘ AI には職位や業界などの抽象的な情報のみが送信され、個人情報は一切送信されません
          </p>
        </div>
      )}

      {status.state === "template" && (
        <EmailTemplatePreview
          template={status.template}
          onApprove={onHydrateTemplate}
          onCancel={onReset}
          loading={isLoading}
        />
      )}

      {status.state === "hydrating" && (
        <div className="border border-white/10 rounded-xl bg-white/5 p-4">
          <p className="text-sm text-slate-300 animate-pulse">
            ⏳ テンプレートに実データを入力中...
          </p>
        </div>
      )}

      {status.state === "complete" && (
        <EmailHydratedPreview
          email={status.email}
          mailto={status.mailto}
          onReset={onReset}
        />
      )}

      {status.state === "error" && (
        <EmailGenerationError
          message={status.message}
          onRetry={() => {
            onReset();
            setTimeout(() => {
              if (!isEmpty) onGenerateTemplate();
            }, 100);
          }}
        />
      )}
    </div>
  );
}
