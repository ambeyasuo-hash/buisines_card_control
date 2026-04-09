// (c) 2026 ambe / Business_Card_Folder
// Gemini Email Template Generator: Zero-Knowledge LLM Integration

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeneratedEmail, AttributesMasked } from "@/types/business-card";
import { createMaskedEmailPrompt, extractPlaceholders } from "@/lib/masking";

/**
 * Initialize Gemini API client (server-side only)
 * API Key must be in environment variable
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate email template using Gemini 2.5 Flash
 * Zero-Knowledge: Prompt contains NO personal information, only masked attributes
 *
 * Security Guarantees:
 * - Gemini receives ONLY abstract metadata (role rank, industry, mission)
 * - No names, companies, or PII ever sent to the API
 * - Output is a template with {{VARIABLE}} placeholders
 * - This function runs server-side (API key protected)
 *
 * @param attributes - Masked attributes (role, industry, mission only)
 * @returns Generated email template with placeholders
 */
export async function generateEmailTemplate(
  attributes: AttributesMasked
): Promise<GeneratedEmail> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Create masked prompt - NO PII included
  const prompt = createMaskedEmailPrompt(attributes);

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();

    // Extract JSON from response (handle markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.subject || !parsed.body) {
      throw new Error("Invalid response structure: missing subject or body");
    }

    // Extract placeholders from actual generated content
    const variables = extractPlaceholders(
      `${parsed.subject}\n${parsed.body}`
    );

    return {
      subject: parsed.subject,
      body: parsed.body,
      variables,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON parsing error from Gemini: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Hydrate email template with actual business card data
 * Replaces {{PLACEHOLDER}} with actual values
 *
 * @param template - Generated email template with {{}} placeholders
 * @param replacements - Map of variable names to actual values
 * @returns Email with placeholders filled in
 */
export function hydrateEmailTemplate(
  template: GeneratedEmail,
  replacements: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  // Replace all {{VARIABLE}} with actual values
  for (const [variable, value] of Object.entries(replacements)) {
    const placeholder = `{{${variable}}}`;
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, value);
  }

  return { subject, body };
}

/**
 * Parse business card data into email variable map
 * Used to hydrate templates with actual contact information
 *
 * @param cardData - Full business card data
 * @param currentUser - Current user data for YOUR_* fields
 * @returns Map of template variables to actual values
 */
export function createEmailVariableMap(
  cardData: {
    full_name?: string;
    title?: string;
    company?: string;
  },
  currentUser: {
    full_name?: string;
    title?: string;
    company?: string;
  }
): Record<string, string> {
  return {
    CONTACT_NAME: cardData.full_name || "Contact",
    CONTACT_TITLE: cardData.title || "Professional",
    COMPANY_NAME: cardData.company || "Company",
    YOUR_NAME: currentUser.full_name || "You",
    YOUR_TITLE: currentUser.title || "Professional",
    YOUR_COMPANY: currentUser.company || "Company",
  };
}
