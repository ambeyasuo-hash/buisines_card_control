// (c) 2026 ambe / Business_Card_Folder
// CSV generation utility for bulk data export

import { BusinessCard } from "@/types";
import { downloadFile } from "@/lib/utils";

export function generateCSV(cards: BusinessCard[]): string {
  // CSV headers in Japanese
  const headers = [
    "氏名",
    "かな",
    "会社",
    "部署",
    "役職",
    "メール",
    "電話",
    "郵便番号",
    "住所",
    "URL",
    "交換日",
    "メモ",
    "位置情報",
  ];

  // Start with headers
  const lines: string[] = [headers.map(escapeCSVValue).join(",")];

  // Add data rows
  for (const card of cards) {
    const row = [
      card.full_name,
      card.kana || "",
      card.company || "",
      card.department || "",
      card.title || "",
      card.email || "",
      card.phone || "",
      card.postal_code || "",
      card.address || "",
      card.url || "",
      card.exchanged_at.slice(0, 10), // YYYY-MM-DD format
      card.notes || "",
      card.location_name || "", // Address name from geolocation
    ];

    lines.push(row.map(escapeCSVValue).join(","));
  }

  return lines.join("\r\n");
}

/**
 * Escape CSV values according to RFC 4180
 * Enclose field in quotes if it contains comma, quote, or newline
 */
function escapeCSVValue(value: string | undefined | null): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Create a downloadable CSV file
 */
export function downloadCSV(cards: BusinessCard[]): void {
  const csv = generateCSV(cards);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadFile(blob, `business_cards_${new Date().toISOString().slice(0, 10)}.csv`);
}
