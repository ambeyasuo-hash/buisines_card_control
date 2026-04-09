# Phase 3: Zero-Knowledge Email Generation Integration Guide

## Overview

Phase 3 implements **privacy-first email template generation** using Gemini 2.5 Flash with complete PII masking. The LLM never sees actual personal information—only abstract metadata about role rank and industry.

## Architecture

### Zero-Knowledge Flow

```
User Business Card Data (with PII)
         ↓
    Masking Layer
  (extractMaskedAttributes)
         ↓
Abstract Metadata Only:
- Role Rank: "manager" (not actual title)
- Industry: "it" (not actual company)
- Mission: "General inquiry" (optional)
         ↓
Gemini API (receives ONLY masked data)
         ↓
Email Template with {{PLACEHOLDERS}}
(CONTACT_NAME, COMPANY_NAME, etc.)
         ↓
User Reviews Template
         ↓
Hydration Layer
(hydrateEmailAction)
         ↓
Final Email with Actual Data
```

## Implementation Files

### 1. **src/lib/masking.ts** — PII Extraction & Masking

Provides utilities to extract abstract attributes without exposing personal data:

```typescript
import {
  extractRankFromTitle,      // "営業部長" → "director"
  inferIndustryFromCompany,  // "ソフトウェア〇〇" → "it"
  extractMaskedAttributes,   // Get {role, industry, mission}
  createMaskedEmailPrompt,   // Create LLM prompt with no PII
  extractPlaceholders        // Find {{VARIABLE}} in text
} from "@/lib/masking";
```

**Key Functions:**
- `extractRankFromTitle(title)` → Converts Japanese job titles to abstract ranks
- `inferIndustryFromCompany(company)` → Classifies industry from company name
- `extractMaskedAttributes(cardData)` → Returns AttributesMasked (NO PII)
- `createMaskedEmailPrompt(attributes)` → Creates LLM prompt with {{}} placeholders

### 2. **src/lib/email-generator.ts** — Gemini Integration

Server-side email template generation with Gemini 2.5 Flash:

```typescript
import {
  generateEmailTemplate,      // Call Gemini with masked prompt
  hydrateEmailTemplate,       // Replace {{}} with actual values
  createEmailVariableMap      // Map card data to template variables
} from "@/lib/email-generator";
```

**Key Functions:**
- `generateEmailTemplate(attributes)` → Returns GeneratedEmail with placeholders
- `hydrateEmailTemplate(template, replacements)` → Fills placeholders
- `createEmailVariableMap(cardData, userData)` → Creates replacement map

### 3. **src/app/actions/email-generation.ts** — Server Actions

Secure server-side execution of email generation:

```typescript
import {
  generateEmailTemplateAction, // Generate template (masked)
  hydrateEmailAction           // Hydrate template (with actual data)
} from "@/app/actions/email-generation";
```

## Integration Examples

### Example 1: Basic Template Generation

```typescript
"use client";

import { useCallback, useState } from "react";
import { generateEmailTemplateAction } from "@/app/actions/email-generation";
import type { BusinessCardData, GeneratedEmail } from "@/types/business-card";

export function EmailGeneratorComponent({
  cardData,
}: {
  cardData: BusinessCardData;
}) {
  const [template, setTemplate] = useState<GeneratedEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Call server action with card data
      // Masking happens SERVER-SIDE (client never sees masked prompt)
      const result = await generateEmailTemplateAction(cardData);

      if (!result.success) {
        setError(result.error || "Failed to generate template");
        return;
      }

      setTemplate(result.template || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }, [cardData]);

  if (!template) {
    return (
      <button
        onClick={handleGenerateTemplate}
        disabled={loading}
      >
        {loading ? "生成中..." : "メールテンプレートを生成"}
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-bold mb-2">生成されたテンプレート</h3>
      <p className="text-sm text-gray-600 mb-3">
        下記のテンプレートを確認して「承認」する場合はボタンを押してください
      </p>

      <div className="bg-gray-50 p-3 rounded mb-3">
        <p className="font-mono text-sm">
          <strong>件名:</strong> {template.subject}
        </p>
        <p className="font-mono text-sm whitespace-pre-wrap mt-2">
          <strong>本文:</strong>
          {template.body}
        </p>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        プレースホルダー: {template.variables.join(", ")}
      </p>

      <button
        onClick={() => setTemplate(null)}
        className="text-blue-600 hover:underline"
      >
        別のテンプレートを生成
      </button>
    </div>
  );
}
```

### Example 2: Template Hydration (Fill with Actual Data)

```typescript
"use client";

import { useState } from "react";
import { hydrateEmailAction } from "@/app/actions/email-generation";
import type { GeneratedEmail, BusinessCardData } from "@/types/business-card";

export function EmailHydrationComponent({
  template,
  cardData,
  currentUser,
}: {
  template: GeneratedEmail;
  cardData: BusinessCardData;
  currentUser: { full_name?: string; title?: string; company?: string };
}) {
  const [hydrated, setHydrated] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleHydrate = async () => {
    setLoading(true);
    try {
      const result = await hydrateEmailAction(
        template,
        cardData,
        currentUser
      );

      if (result.success && result.email) {
        setHydrated(result.email);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <button onClick={handleHydrate} disabled={loading}>
        {loading ? "入力中..." : "テンプレートに実データを入力"}
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-blue-50">
      <h3 className="font-bold mb-2">完成したメール</h3>

      <div className="bg-white p-3 rounded mb-3">
        <p className="font-mono text-sm">
          <strong>件名:</strong> {hydrated.subject}
        </p>
        <p className="font-mono text-sm whitespace-pre-wrap mt-2">
          <strong>本文:</strong>
          {hydrated.body}
        </p>
      </div>

      <a
        href={`mailto:${cardData.email}?subject=${encodeURIComponent(
          hydrated.subject
        )}&body=${encodeURIComponent(hydrated.body)}`}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        メールを送信
      </a>
    </div>
  );
}
```

### Example 3: Integration with useEmailDraft Hook (Phase 3 Style)

```typescript
"use client";

import { useCallback } from "react";
import { generateEmailTemplateAction } from "@/app/actions/email-generation";
import { useEmailDraft } from "@/hooks/useEmailDraft";
import type { BusinessCardData } from "@/types/business-card";

export function Phase3EmailGenerator({
  cardData,
}: {
  cardData: BusinessCardData;
}) {
  // Generator function for useEmailDraft
  const emailGenerator = useCallback(async () => {
    // Note: This receives the ENTIRE cardData but masking happens server-side
    const result = await generateEmailTemplateAction(cardData);

    if (!result.success || !result.template) {
      throw new Error(result.error || "Template generation failed");
    }

    // Return template with placeholders (not hydrated yet)
    return {
      subject: result.template.subject,
      body: result.template.body,
    };
  }, [cardData]);

  // Use the hook for UI state management
  const { mailStatus, onGenerateMail } = useEmailDraft({
    emailAddress: cardData.email,
    generator: emailGenerator,
  });

  return (
    <div className="space-y-3">
      {mailStatus.state === "idle" && (
        <button
          onClick={onGenerateMail}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          AI メール生成
        </button>
      )}

      {mailStatus.state === "running" && (
        <p className="text-gray-600">
          AI がメールテンプレートを生成中...
        </p>
      )}

      {mailStatus.state === "ok" && (
        <div className="bg-green-50 p-4 rounded">
          <p className="mb-2">
            <strong>件名:</strong> {mailStatus.subject}
          </p>
          <p className="whitespace-pre-wrap mb-3">
            <strong>本文:</strong>
            {mailStatus.body}
          </p>
          <a
            href={mailStatus.mailto}
            className="text-blue-600 hover:underline"
          >
            このメールを送信
          </a>
        </div>
      )}

      {mailStatus.state === "ng" && (
        <p className="text-red-600">エラー: {mailStatus.message}</p>
      )}
    </div>
  );
}
```

## Security Guarantees

### What Gemini Sees

```typescript
// Example masked prompt sent to Gemini
{
  "role_rank": "manager",           // NOT the actual job title
  "industry": "it",                 // NOT the actual company name
  "mission": "General inquiry"      // NOT the actual contact info
}
```

### What Gemini Does NOT See

- ✗ Contact name
- ✗ Company name
- ✗ Email address
- ✗ Phone number
- ✗ Any personally identifiable information

### Response Format

```typescript
{
  "subject": "{{CONTACT_NAME}} 様へのご連絡",
  "body": "{{CONTACT_NAME}} 様\n\n...",
  "variables": ["CONTACT_NAME", "COMPANY_NAME", "YOUR_NAME", ...]
}
```

## Environment Configuration

Required API key in `.env.local`:

```bash
# Google Gemini API (Phase 3 Email Generation)
# Get from: https://aistudio.google.com/apikey
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

## Testing the Integration

1. **Verify masking works:**
   ```typescript
   import { extractMaskedAttributes } from "@/lib/masking";
   const card = { /* business card data */ };
   const masked = extractMaskedAttributes(card);
   // Should contain only { role, industry, mission }
   ```

2. **Test template generation:**
   ```typescript
   import { generateEmailTemplate } from "@/lib/email-generator";
   const template = await generateEmailTemplate({
     role: "manager",
     industry: "it",
   });
   // Should have {{ }} placeholders, no real data
   ```

3. **Test hydration:**
   ```typescript
   import { hydrateEmailTemplate } from "@/lib/email-generator";
   const final = hydrateEmailTemplate(template, {
     CONTACT_NAME: "山田太郎",
     COMPANY_NAME: "株式会社〇〇",
     // ... other variables
   });
   // Should have real data now
   ```

## Migration Path (Phase 2 → Phase 3)

### Before (Legacy generateThankYouEmailDraft)
```typescript
const draft = generateThankYouEmailDraft({
  toName: cardData.full_name,
  toCompany: cardData.company,
});
```

### After (Phase 3 Zero-Knowledge)
```typescript
const result = await generateEmailTemplateAction(cardData);
if (result.success && result.template) {
  // Template has {{ }} placeholders
  // User can review before hydrating with actual data
  const hydrated = await hydrateEmailAction(
    result.template,
    cardData,
    currentUser
  );
}
```

## Type Definitions

```typescript
// From src/types/business-card.ts

export interface AttributesMasked {
  role: string;        // "executive" | "director" | "manager" | "senior" | "staff"
  industry: string;    // "it" | "finance" | "trading" | "manufacturing" | etc.
  mission?: string;    // User-selected category
}

export interface GeneratedEmail {
  subject: string;           // With {{ }} placeholders
  body: string;              // With {{ }} placeholders
  variables: string[];       // List of placeholder variable names
}

export interface HydratedEmail extends GeneratedEmail {
  subject_rendered: string;  // Filled with actual values
  body_rendered: string;     // Filled with actual values
}
```

## Next Steps

1. **Update new card page** to offer both legacy and Phase 3 email generation
2. **Add user preferences** for email tone (formal, casual, technical)
3. **Implement email history** to track generated templates
4. **Add A/B testing** to improve Gemini prompts
5. **Phase 4**: Advanced image preprocessing with OpenCV.js

## Troubleshooting

### "GOOGLE_GEMINI_API_KEY is not configured"
- Ensure `.env.local` has `GOOGLE_GEMINI_API_KEY`
- Verify API key is valid at https://aistudio.google.com/apikey
- Check that the key has Gemini API enabled

### Templates contain no placeholders
- Check that Gemini response is valid JSON
- Verify the masked prompt is being generated correctly
- Check Gemini API response format matches expected structure

### Hydration missing variables
- Ensure all variables in template are in the replacement map
- Check `createEmailVariableMap()` is returning all required fields
- Verify business card data has all necessary fields populated

---

**Last Updated:** 2026-04-09
**Status:** Phase 3 Implementation Complete ✓
