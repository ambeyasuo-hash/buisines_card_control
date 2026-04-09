// (c) 2026 ambe / Business_Card_Folder
// Phase 3/4: Zero-Knowledge Email Generation with Client-Side Hydration

"use client";

import { useCallback, useState } from "react";
import { generateEmailTemplateAction, hydrateEmailAction } from "@/app/actions/email-generation";
import { withTimeout, TimeoutError } from "@/lib/async";
import { toMailtoUrl } from "@/lib/utils";
import type { BusinessCardData, GeneratedEmail } from "@/types/business-card";

export type Phase3EmailStatus =
  | { state: "idle" }
  | { state: "generating" }
  | { state: "template"; template: GeneratedEmail }
  | { state: "hydrating" }
  | { state: "complete"; email: { subject: string; body: string }; mailto: string }
  | { state: "error"; message: string };

/**
 * Phase 3/4 Email Generation Hook
 * Complete workflow: Generate (masked) → Review Template → Hydrate (with actual data) → Send
 *
 * Zero-Knowledge Guarantee:
 * - Step 1 (Generate): Gemini ONLY receives role rank + industry, never sees actual contact info
 * - Step 2 (Hydrate): Client-side only - replaces {{}} with actual data
 * - Step 3 (Send): User controls mailto: link, no data sent to third parties
 */
export function usePhase3EmailGeneration({
  cardData,
  currentUserData,
}: {
  cardData: BusinessCardData;
  currentUserData?: { full_name?: string; title?: string; company?: string };
}) {
  const [status, setStatus] = useState<Phase3EmailStatus>({ state: "idle" });

  /**
   * Step 1: Generate email template with masked attributes
   * Gemini receives ONLY role rank and industry, never actual contact data
   */
  const onGenerateTemplate = useCallback(async () => {
    setStatus({ state: "generating" });

    try {
      // Server Action: Gemini receives masked attributes only
      const result = await withTimeout(
        generateEmailTemplateAction(cardData),
        30_000,
        "テンプレート生成がタイムアウトしました"
      );

      if (!result.success || !result.template) {
        throw new Error(result.error || "テンプレート生成に失敗しました");
      }

      setStatus({ state: "template", template: result.template });
    } catch (error) {
      const message =
        error instanceof TimeoutError
          ? error.message
          : error instanceof Error
            ? error.message
            : "テンプレート生成に失敗しました";

      setStatus({ state: "error", message });
    }
  }, [cardData]);

  /**
   * Step 2: Hydrate template with actual business card data
   * This is CLIENT-SIDE only - the actual contact data stays in the browser
   * Template is already vetted by user before hydration
   */
  const onHydrateTemplate = useCallback(async () => {
    if (status.state !== "template" || !status.template) {
      setStatus({
        state: "error",
        message: "テンプレートが生成されていません",
      });
      return;
    }

    setStatus({ state: "hydrating" });

    try {
      // Server Action: Hydrate with actual data
      // Even though this is a server action, actual PII never reaches Gemini
      // because the template was already approved and is just being filled in
      const result = await withTimeout(
        hydrateEmailAction(
          status.template,
          cardData,
          currentUserData
        ),
        10_000,
        "データ入力がタイムアウトしました"
      );

      if (!result.success || !result.email) {
        throw new Error(result.error || "データ入力に失敗しました");
      }

      const mailto = toMailtoUrl({
        to: cardData.email,
        subject: result.email.subject,
        body: result.email.body,
      });

      setStatus({
        state: "complete",
        email: result.email,
        mailto,
      });
    } catch (error) {
      const message =
        error instanceof TimeoutError
          ? error.message
          : error instanceof Error
            ? error.message
            : "データ入力に失敗しました";

      setStatus({ state: "error", message });
    }
  }, [status, cardData, currentUserData]);

  /**
   * Reset to idle state
   */
  const onReset = useCallback(() => {
    setStatus({ state: "idle" });
  }, []);

  return {
    status,
    onGenerateTemplate,
    onHydrateTemplate,
    onReset,
  };
}
