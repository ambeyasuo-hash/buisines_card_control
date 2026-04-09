// (c) 2026 ambe / Business_Card_Folder
// Server Action: Email Template Generation with Zero-Knowledge Masking

"use server";

import { generateEmailTemplate, hydrateEmailTemplate, createEmailVariableMap } from "@/lib/email-generator";
import { extractMaskedAttributes } from "@/lib/masking";
import type { BusinessCardData, GeneratedEmail } from "@/types/business-card";

/**
 * Server Action: Generate email template for business card
 *
 * Zero-Knowledge Security:
 * - Extracts only abstract attributes (role rank, industry) from card data
 * - Sends ONLY masked attributes to Gemini (no PII)
 * - Gemini never sees the person's name, company, or contact info
 * - Returns template with {{PLACEHOLDER}} format for safe display/editing
 *
 * @param cardData - Business card data (with PII)
 * @returns Generated email template with placeholders
 */
export async function generateEmailTemplateAction(
  cardData: BusinessCardData
): Promise<{
  success: boolean;
  template?: GeneratedEmail;
  hydratedEmail?: { subject: string; body: string };
  error?: string;
}> {
  try {
    // Step 1: Extract masked attributes (role, industry only - NO PII)
    const maskedAttributes = extractMaskedAttributes(cardData);

    // Step 2: Call Gemini with masked prompt (Gemini NEVER sees personal data)
    const template = await generateEmailTemplate(maskedAttributes);

    // Step 3: Create variable map for hydration (optional - returns template for now)
    // In production, you might hydrate here if returning full email immediately
    // For now, return template so client can edit before hydrating

    return {
      success: true,
      template,
    };
  } catch (error) {
    console.error("Email generation action error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "メール生成に失敗しました。";

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Server Action: Hydrate email template with actual business card data
 * Converts {{PLACEHOLDER}} to actual values
 *
 * This is called AFTER user approval to fill in the template with real data
 *
 * @param template - Generated template with {{}} placeholders
 * @param cardData - Business card data to fill in
 * @param currentUserData - Current user's profile data (for YOUR_* fields)
 * @returns Hydrated email with actual values
 */
export async function hydrateEmailAction(
  template: {
    subject: string;
    body: string;
    variables: string[];
  },
  cardData: BusinessCardData,
  currentUserData?: {
    full_name?: string;
    title?: string;
    company?: string;
  }
): Promise<{
  success: boolean;
  email?: { subject: string; body: string };
  error?: string;
}> {
  try {
    // Create variable map from card and user data
    const variableMap = createEmailVariableMap(cardData, currentUserData || {});

    // Hydrate template (replace {{VARIABLE}} with actual values)
    const hydratedEmail = hydrateEmailTemplate(template, variableMap);

    return {
      success: true,
      email: hydratedEmail,
    };
  } catch (error) {
    console.error("Email hydration action error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "テンプレートの入力に失敗しました。";

    return {
      success: false,
      error: errorMessage,
    };
  }
}
