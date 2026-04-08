// (c) 2026 ambe / Business_Card_Folder
// Regex-based parser that converts raw Tesseract OCR text into a
// structured CardOCRResult.  All processing is client-side; no data
// leaves the browser.

import type { CardOCRResult } from "@/types";

// ─── patterns ──────────────────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const URL_RE =
  /https?:\/\/[^\s\u3000-\u9fff\uff00-\uffef]+|www\.[^\s\u3000-\u9fff\uff00-\uffef]+/;

// Japanese landline: 03-xxxx-xxxx, 0120-xxx-xxx, +81-3-xxxx-xxxx, etc.
const PHONE_JP_RE =
  /(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|\+81[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})/;

// Mobile: 090/080/070
const MOBILE_RE = /0[789]0[-\s]?\d{4}[-\s]?\d{4}/;

const POSTAL_RE = /〒?\s*\d{3}[-‐]\d{4}/;

// Company suffix detection
const COMPANY_SUFFIX_RE =
  /株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|公益社団法人|一般財団法人|公益財団法人|医療法人|学校法人|社会福祉法人|Co\.|Corp\.|Inc\.|Ltd\.|LLC/i;

// Title keywords common on JP business cards
const TITLE_KW_RE =
  /代表取締役|取締役|社長|副社長|専務|常務|部長|課長|係長|主任|マネージャー|ディレクター|エンジニア|デザイナー|コンサルタント|アドバイザー|プランナー|アナリスト|executive|director|manager|engineer|designer/i;

// ─── extractors ────────────────────────────────────────────────────────────

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[0].trim() : null;
}

function extractEmail(text: string): string | null {
  return firstMatch(text, EMAIL_RE);
}

function extractWebsite(text: string): string | null {
  const noEmail = text.replace(EMAIL_RE, "");
  return firstMatch(noEmail, URL_RE);
}

function extractPostalCode(text: string): string | null {
  const m = text.match(POSTAL_RE);
  if (!m) return null;
  return m[0].replace("〒", "").trim();
}

function extractPhone(lines: string[]): string | null {
  for (const line of lines) {
    if (MOBILE_RE.test(line)) continue; // let extractMobile handle these
    const m = line.match(PHONE_JP_RE);
    if (m) return m[0];
  }
  return null;
}

function extractMobile(lines: string[]): string | null {
  for (const line of lines) {
    const m = line.match(MOBILE_RE);
    if (m) return m[0];
  }
  return null;
}

function extractCompany(lines: string[]): string | null {
  for (const line of lines) {
    if (COMPANY_SUFFIX_RE.test(line)) return line.trim();
  }
  return null;
}

function extractTitle(lines: string[], companyLine: string | null): string | null {
  for (const line of lines) {
    if (line === companyLine) continue;
    if (TITLE_KW_RE.test(line)) return line.trim();
  }
  return null;
}

function extractAddress(lines: string[], postalCode: string | null): string | null {
  if (!postalCode) return null;
  const idx = lines.findIndex((l) => POSTAL_RE.test(l));
  if (idx === -1) return null;
  const addrLines: string[] = [];
  for (let i = idx; i < Math.min(idx + 3, lines.length); i++) {
    const l = lines[i].replace(POSTAL_RE, "").trim();
    if (l) addrLines.push(l);
  }
  return addrLines.join(" ").trim() || null;
}

function extractName(lines: string[], skipLines: (string | null)[]): string | null {
  const skipSet = new Set(skipLines.filter(Boolean) as string[]);
  // Name candidates: short lines (2-15 chars) that don't match any known patterns
  const candidates = lines.filter(
    (l) =>
      l.length >= 2 &&
      l.length <= 15 &&
      !skipSet.has(l) &&
      !EMAIL_RE.test(l) &&
      !URL_RE.test(l) &&
      !PHONE_JP_RE.test(l) &&
      !POSTAL_RE.test(l) &&
      !COMPANY_SUFFIX_RE.test(l) &&
      !TITLE_KW_RE.test(l)
  );
  return candidates[0] ?? null;
}

// ─── public API ────────────────────────────────────────────────────────────

export function parseBusinessCardText(rawText: string): Partial<CardOCRResult> {
  const lines = rawText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);

  const email = extractEmail(rawText);
  const website = extractWebsite(rawText);
  const postalCode = extractPostalCode(rawText);
  const phone = extractPhone(lines);
  const mobile = extractMobile(lines);
  const company = extractCompany(lines);
  const title = extractTitle(lines, company);
  const address = extractAddress(lines, postalCode);
  const name = extractName(lines, [email, website, phone, mobile, company, title, address]);

  return {
    name: name ?? null,
    name_kana: null, // Tesseract cannot generate kana readings reliably
    company: company ?? null,
    department: null,
    title: title ?? null,
    email: email ?? null,
    phone: phone ?? null,
    mobile: mobile ?? null,
    address: address ?? null,
    website: website ?? null,
    notes: null,
  };
}
