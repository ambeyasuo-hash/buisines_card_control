// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useState } from "react";
import { withTimeout, TimeoutError } from "@/lib/async";
import { toMailtoUrl } from "@/lib/utils";

export type EmailDraftStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "ok"; subject: string; body: string; mailto: string }
  | { state: "ng"; message: string };

/**
 * メール下書き生成ロジックを共通化するカスタムフック。
 * `generator` に Gemini 関数の呼び出しを渡す — フック自体は AI 実装に依存しない。
 *
 * @param emailAddress - 送信先メールアドレス（任意）
 * @param generator    - メール下書きを生成する非同期関数
 */
export function useEmailDraft({
  emailAddress,
  generator,
}: {
  emailAddress?: string;
  generator: () => Promise<{ subject: string; body: string }>;
}) {
  const [mailStatus, setMailStatus] = useState<EmailDraftStatus>({ state: "idle" });

  const onGenerateMail = useCallback(async () => {
    setMailStatus({ state: "running" });
    try {
      const draft = await withTimeout(
        generator(),
        30_000,
        "メール生成がタイムアウトしました（ネットワークをご確認ください）"
      );

      const mailto = toMailtoUrl({
        to: emailAddress?.trim() || undefined,
        subject: draft.subject,
        body: draft.body,
      });

      setMailStatus({ state: "ok", subject: draft.subject, body: draft.body, mailto });
    } catch (e) {
      const message =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "メール生成に失敗しました";
      setMailStatus({ state: "ng", message });
    }
  }, [emailAddress, generator]);

  return { mailStatus, onGenerateMail };
}
