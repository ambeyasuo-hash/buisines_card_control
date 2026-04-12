/**
 * Normalization Module for Business Card Data
 * Implements organizational suffix removal, lowercasing, and half-width conversion
 * as per Ambe Design System v5.0.5
 */

// Common Japanese corporate suffixes and organizational identifiers to remove
const ORGANIZATIONAL_SUFFIXES = [
  // 法人形態
  "株式会社",
  "有限会社",
  "合同会社",
  "合資会社",
  "合名会社",
  "一般社団法人",
  "一般財団法人",
  "公益社団法人",
  "公益財団法人",
  "特定非営利活動法人",
  "npo法人",
  // Abbreviated forms
  "㈱",
  "㈲",
  "LLC",
  "Ltd.",
  "Inc.",
  "Corp.",
  "Co.",
  "Co., Ltd.",
  "株式会社(かぶしきがいしゃ)",
];

/**
 * Convert full-width characters to half-width
 * @param str Input string (may contain full-width katakana, numbers, etc.)
 * @returns Normalized half-width string
 */
function toHalfWidth(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    })
    .replace(/[！-～]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    });
}

/**
 * Remove organizational suffixes from company name
 * @param companyName Company name with potential suffixes
 * @returns Company name with suffixes removed
 */
export function removeOrganizationalSuffix(companyName: string): string {
  let normalized = companyName.trim();

  // Remove leading/trailing whitespace and parentheses
  normalized = normalized.replace(/^\s*\(|\)\s*$/g, "");

  // Remove organizational suffixes
  for (const suffix of ORGANIZATIONAL_SUFFIXES) {
    const regex = new RegExp(`${suffix}\\s*$`, "gi");
    normalized = normalized.replace(regex, "");
  }

  return normalized.trim();
}

/**
 * Normalize company name: remove suffixes, lowercase, and convert to half-width
 * @param companyName Raw company name
 * @returns Normalized company name
 */
export function normalizeCompanyName(companyName: string): string {
  let normalized = companyName.trim();

  // Remove organizational suffixes
  normalized = removeOrganizationalSuffix(normalized);

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Convert full-width to half-width
  normalized = toHalfWidth(normalized);

  return normalized;
}

/**
 * Split normalized name into searchable tokens
 * Removes punctuation and splits by whitespace
 * @param name Normalized name
 * @returns Array of searchable tokens
 */
export function tokenizeForSearch(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF]/g, "") // Keep alphanumeric and Japanese
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Normalize person name: lowercase and half-width conversion
 * @param personName First or last name
 * @returns Normalized name
 */
export function normalizePersonName(personName: string): string {
  let normalized = personName.trim();

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Convert full-width to half-width (mainly for katakana)
  normalized = toHalfWidth(normalized);

  return normalized;
}

/**
 * Batch normalization for search indexes
 * Normalizes company name and person names for Blind Indexing
 * @param data Business card data
 * @returns Normalized search tokens
 */
export function normalizeForBlindIndexing(data: {
  company?: string;
  lastName?: string;
  firstName?: string;
}): string[] {
  const tokens: Set<string> = new Set();

  // Company name normalization
  if (data.company) {
    const normalizedCompany = normalizeCompanyName(data.company);
    tokenizeForSearch(normalizedCompany).forEach((token) =>
      tokens.add(token)
    );
  }

  // Person name normalization (last name + first name)
  if (data.lastName) {
    const normalizedLast = normalizePersonName(data.lastName);
    tokenizeForSearch(normalizedLast).forEach((token) => tokens.add(token));
  }

  if (data.firstName) {
    const normalizedFirst = normalizePersonName(data.firstName);
    tokenizeForSearch(normalizedFirst).forEach((token) =>
      tokens.add(token)
    );
  }

  return Array.from(tokens);
}
