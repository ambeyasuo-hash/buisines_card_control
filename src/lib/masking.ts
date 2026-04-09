// (c) 2026 ambe / Business_Card_Folder
// PII Masking Utility: Extract abstract attributes without exposing personal data

import type { BusinessCardData, AttributesMasked } from "@/types/business-card";

/**
 * Japanese job title rank classification
 * Maps job titles to rank levels for AI hint generation
 */
const JAPANESE_RANK_PATTERNS = {
  executive: [
    "代表",
    "会長",
    "社長",
    "副社長",
    "専務",
    "常務",
    "CEO",
    "COO",
    "CTO",
    "CFO",
  ],
  director: ["部長", "事業部長", "営業部長", "技術部長", "企画部長"],
  manager: ["課長", "グループ長", "マネージャー", "lead", "manager"],
  senior: ["主任", "シニア", "senior", "specialist"],
  staff: ["営業", "企画", "技術", "スタッフ", "職員"],
};

/**
 * DEPRECATED: Industry classification patterns
 * REASON: Company name pattern matching violates zero-knowledge principle (PII)
 *
 * These patterns are no longer used. Industry is now determined by:
 * 1. User selection via UI (preferred)
 * 2. Default category value (fallback)
 *
 * Do not use company name or domain patterns for industry inference.
 */
// const INDUSTRY_PATTERNS = {
//   it: ["IT", "ソフトウェア", "シスコン", "コンピュータ", "デジタル", "テック", "システム"],
//   finance: ["銀行", "証券", "保険", "金融", "ファイナンス", "投資"],
//   trading: ["商社", "貿易", "輸入", "輸出", "流通"],
//   manufacturing: ["製造", "工業", "機械", "電子", "重工"],
//   consulting: ["コンサル", "コンサルティング", "アドバイザリー"],
//   logistics: ["運輸", "物流", "配送", "倉庫"],
//   retail: ["小売", "百貨店", "EC", "販売"],
//   construction: ["建設", "不動産", "ゼネコン", "開発"],
//   healthcare: ["医療", "病院", "医薬", "ヘルスケア", "診療"],
//   education: ["教育", "学園", "大学", "学校"],
//   media: ["メディア", "放送", "新聞", "出版", "広告"],
// };

/**
 * Extract rank level from Japanese job title
 * Maps specific titles to abstracted role levels
 *
 * @param title - Job title string (e.g., "営業部長")
 * @returns Rank level for AI hint (e.g., "manager")
 */
export function extractRankFromTitle(title: string): string {
  if (!title) return "staff";

  for (const [rank, patterns] of Object.entries(JAPANESE_RANK_PATTERNS)) {
    if (patterns.some((pattern) => title.includes(pattern))) {
      return rank;
    }
  }

  return "staff";
}

/**
 * DEPRECATED: Do not infer industry from company name (PII)
 *
 * Zero-Knowledge requirement: Company names are PII and must not be processed
 * for attribute extraction.
 *
 * Use extractMaskedAttributes() with user-selected category instead.
 *
 * @deprecated Use user-selected category or category default instead
 */
export function inferIndustryFromCompany(company: string): string {
  // DEPRECATED - Company name processing violates zero-knowledge principle
  // Always return "other" - let user select industry via UI
  return "other";
}

/**
 * Extract abstract attributes from business card data
 * ZERO-KNOWLEDGE: Personal information is NOT included
 *
 * This function extracts only abstract metadata that helps the LLM generate
 * appropriate email templates without ever knowing who the person is.
 *
 * Industry determination:
 * - User-selected category is preferred (passed via mission or category_id)
 * - Falls back to "other" if not provided
 * - NEVER infers from company name or domain (PII violation)
 *
 * @param cardData - Full business card data (with PII)
 * @returns Masked attributes for LLM prompt (no PII)
 */
export function extractMaskedAttributes(
  cardData: BusinessCardData
): AttributesMasked {
  // Determine industry from user selection, NOT from company/domain
  // TODO: Replace "other" with cardData.user_selected_industry when UI is implemented
  const industry = cardData.category_id ? "selected" : "other";

  return {
    role: extractRankFromTitle(cardData.title),
    industry, // User selection or default "other" - never from PII
    mission: undefined, // User will select manually if needed
  };
}

/**
 * Create a zero-knowledge prompt for email generation
 * All personal information is masked with placeholders
 *
 * @param attributes - Masked attributes (no PII)
 * @returns LLM prompt with placeholders, no personal data exposed
 */
export function createMaskedEmailPrompt(attributes: AttributesMasked): string {
  const role = attributes.role;
  const industry = attributes.industry;

  return `You are a professional business email writer. Generate a concise, respectful email template to initiate business relationship with a contact.

## METADATA (Abstract, no personal information):
- Role Rank: ${role} (executive/director/manager/senior/staff)
- Industry: ${industry}
- Mission: ${attributes.mission || "General business inquiry"}

## TEMPLATE REQUIREMENTS:
1. Subject line should be professional and engaging
2. Body should be 2-3 paragraphs maximum
3. Use {{CONTACT_NAME}}, {{CONTACT_TITLE}}, {{COMPANY_NAME}}, {{YOUR_NAME}}, {{YOUR_TITLE}}, {{YOUR_COMPANY}} as placeholders
4. Tone should match the role rank (executives: formal, staff: friendly-professional)
5. Reference the industry naturally if relevant
6. No actual names, companies, or personal details should appear

## OUTPUT FORMAT:
Respond with ONLY valid JSON, no markdown:
{
  "subject": "Subject line with placeholders like {{CONTACT_NAME}}",
  "body": "Full email body with placeholders...",
  "variables": ["CONTACT_NAME", "CONTACT_TITLE", "COMPANY_NAME", "YOUR_NAME", "YOUR_TITLE", "YOUR_COMPANY"]
}`;
}

/**
 * Extract placeholder variables from generated email text
 * Finds all {{VARIABLE}} patterns in subject and body
 *
 * @param text - Email text with placeholders
 * @returns Array of placeholder variable names
 */
export function extractPlaceholders(text: string): string[] {
  const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
  const matches = text.matchAll(placeholderRegex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables).sort();
}
