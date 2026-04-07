// (c) 2026 ambe / Business_Card_Folder
// vCard generation utility for contact export

import { BusinessCard } from "@/types";

export function generateVCard(card: BusinessCard): string {
  // Format date as YYYYMMDD for vCard
  const exchangeDate = card.exchanged_at
    ? new Date(card.exchanged_at).toISOString().split("T")[0].replace(/-/g, "")
    : "";

  // Build vCard properties
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

  // FN (Full Name) - required
  lines.push(`FN:${escapeVCardValue(card.full_name)}`);

  // ORG (Organization)
  if (card.company) {
    const org = card.department
      ? `${escapeVCardValue(card.company)};${escapeVCardValue(card.department)}`
      : escapeVCardValue(card.company);
    lines.push(`ORG:${org}`);
  }

  // TITLE (Job Title)
  if (card.title) {
    lines.push(`TITLE:${escapeVCardValue(card.title)}`);
  }

  // TEL (Phone Number)
  if (card.phone) {
    const cleanPhone = escapeVCardValue(card.phone);
    lines.push(`TEL;TYPE=VOICE:${cleanPhone}`);
  }

  // EMAIL
  if (card.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(card.email)}`);
  }

  // ADR (Address)
  if (card.address) {
    // ADR format: PO Box;Extended Address;Street;Locality;Region;Postal Code;Country
    lines.push(`ADR:;;${escapeVCardValue(card.address)};${escapeVCardValue(card.location_name || "")};;\;`);
  }

  // URL (Website)
  if (card.url) {
    lines.push(`URL:${escapeVCardValue(card.url)}`);
  }

  // NOTE (Notes)
  if (card.notes) {
    lines.push(`NOTE:${escapeVCardValue(card.notes)}`);
  }

  // REV (Revision timestamp)
  const now = new Date();
  const revDate = now
    .toISOString()
    .replace(/[-:T]/g, "")
    .split(".")[0] + "Z";
  lines.push(`REV:${revDate}`);

  lines.push("END:VCARD");

  return lines.join("\r\n");
}

/**
 * Escape special characters in vCard values
 * According to RFC 2426
 */
function escapeVCardValue(value: string): string {
  if (!value) return "";
  return value
    .replace(/\\/g, "\\\\") // Backslash must be escaped first
    .replace(/;/g, "\\;") // Semicolon
    .replace(/,/g, "\\,") // Comma
    .replace(/\r\n/g, "\\n") // CRLF -> \n
    .replace(/\n/g, "\\n"); // LF -> \n
}

/**
 * Create a downloadable vCard file
 */
export function downloadVCard(card: BusinessCard): void {
  const vcard = generateVCard(card);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const filename = `${card.full_name}_${card.exchanged_at.slice(0, 10)}.vcf`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
