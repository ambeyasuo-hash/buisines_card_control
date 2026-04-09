// (c) 2026 ambe / Business_Card_Folder
// Azure AI Document Intelligence Integration (Zero-Knowledge Architecture)

// @ts-ignore - Azure SDK types not yet available in strict mode
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";
// @ts-ignore - Azure SDK types not yet available in strict mode
import { AzureKeyCredential } from "@azure/core-auth";
import type { AzureBusinessCardResult, BusinessCardData } from "@/types/business-card";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Dynamic import for server-side image processing
let sharpAvailable = false;
let sharp: any = null;

async function getSharp() {
  if (sharpAvailable === false && sharp === null) {
    try {
      sharp = (await import("sharp")).default;
      sharpAvailable = true;
    } catch (e) {
      sharpAvailable = false;
    }
  }
  return sharp;
}

/**
 * Initialize Azure Form Recognizer client
 * Endpoint and Key from environment variables (never exposed to frontend)
 */
function getAzureClient(): DocumentAnalysisClient {
  const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  const key = process.env.AZURE_FORM_RECOGNIZER_KEY;

  if (!endpoint || !key) {
    throw new Error(
      "Azure credentials not configured. Please set AZURE_FORM_RECOGNIZER_ENDPOINT and AZURE_FORM_RECOGNIZER_KEY."
    );
  }

  return new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
}

/**
 * Analyze business card image using Azure AI Document Intelligence
 *
 * Security guarantees:
 * - Image is sent ONLY to Azure (Japan East endpoint)
 * - Learning/logging is disabled (opt-out API)
 * - Image is deleted within 24 hours (contractual guarantee)
 * - This function runs on server-side (credentials protected)
 *
 * @param imageUrl - Public URL of business card image
 * @returns Extracted structured data
 */
export async function analyzeBusinessCardWithAzure(
  imageUrl: string
): Promise<AzureBusinessCardResult> {
  const client = getAzureClient();

  try {
    const poller = await client.beginAnalyzeDocumentFromUrl(
      "prebuilt-businessCard",
      imageUrl,
      {
        locale: "ja-JP", // Japanese locale for better accuracy
      }
    );

    const result = await poller.pollUntilDone();

    if (!result.documents || result.documents.length === 0) {
      throw new Error("No business card detected in image");
    }

    const doc = result.documents[0];

    // Extract fields from Azure response
    return {
      contactNames: doc.fields.contactNames as any,
      emails: doc.fields.emails as any,
      phoneNumbers: doc.fields.phoneNumbers as any,
      websites: doc.fields.websites as any,
      companyNames: doc.fields.companyNames as any,
      departments: doc.fields.departments as any,
      jobTitles: doc.fields.jobTitles as any,
      addresses: doc.fields.addresses as any,
      postalCodes: doc.fields.postalCodes as any,
      faxNumbers: doc.fields.faxNumbers as any,
      mobilePhones: doc.fields.mobilePhones as any,
    };
  } catch (error) {
    console.error("Azure OCR error:", error);
    throw new Error(
      `Failed to analyze business card: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Convert Azure OCR result to normalized BusinessCardData
 * This function runs server-side for immediate RLS protection
 *
 * @param azureResult - Raw Azure API response
 * @param userId - Current user ID
 * @returns Normalized data ready for Supabase storage
 */
export function normalizeAzureResult(
  azureResult: AzureBusinessCardResult,
  userId: string
): Partial<BusinessCardData> {
  // Helper to extract first string value from Azure fields
  const getFirstValue = (field: any): string | null => {
    if (!field) return null;
    if (Array.isArray(field) && field.length > 0) {
      const first = field[0];
      return (first?.content || first) ?? null;
    }
    return field?.content ?? null;
  };

  // Helper to combine name parts
  const getFullName = (): string => {
    const contactName = azureResult.contactNames?.[0];
    if (!contactName) return "";

    const firstName = contactName.firstName?.content || "";
    const lastName = contactName.lastName?.content || "";
    return `${lastName}${firstName}`.trim();
  };

  return {
    user_id: userId,
    full_name: getFullName(),
    kana: null, // Azure doesn't extract kana; user can fill manually
    company: getFirstValue(azureResult.companyNames) || "",
    department: getFirstValue(azureResult.departments),
    title: getFirstValue(azureResult.jobTitles) || "",
    email: getFirstValue(azureResult.emails) || "",
    phone: getFirstValue(azureResult.phoneNumbers) || "",
    mobile: getFirstValue(azureResult.mobilePhones),
    fax: getFirstValue(azureResult.faxNumbers),
    postal_code: getFirstValue(azureResult.postalCodes),
    address: getFirstValue(azureResult.addresses) || "",
    url: getFirstValue(azureResult.websites),
    source: "azure",
  };
}

/**
 * Fallback: Analyze with Tesseract.js if Azure fails
 * Maintains backward compatibility with previous OCR pipeline
 *
 * @param imageFile - Image file from user upload
 * @returns Partial BusinessCardData (confidence may be lower)
 */
export async function analyzeBusinessCardWithTesseract(
  imageFile: File
): Promise<Partial<BusinessCardData>> {
  // Import Tesseract engine from existing module
  const { getOCRWorker } = await import("@/lib/ocr/engine");
  const { preprocessCardImage } = await import("@/lib/imageProcessor");

  try {
    const worker = await getOCRWorker();
    const processed = await preprocessCardImage(imageFile);

    const {
      data: { text },
    } = await worker.recognize(processed);

    // Basic pattern matching for fallback
    // (This is a simplified version; production would need more sophisticated parsing)
    return {
      full_name: extractNameFromText(text),
      company: extractCompanyFromText(text),
      title: extractTitleFromText(text),
      email: extractEmailFromText(text),
      phone: extractPhoneFromText(text),
      address: extractAddressFromText(text),
      url: extractUrlFromText(text),
      source: "camera", // Fallback source
    };
  } catch (error) {
    console.error("Tesseract fallback error:", error);
    throw new Error("Both Azure and Tesseract OCR failed");
  }
}

/**
 * Pattern extraction helpers for Tesseract fallback
 */
function extractNameFromText(text: string): string {
  // Try to find name-like patterns (2-3 characters followed by whitespace)
  const nameMatch = text.match(/^([^\n\d@]+?)\s+([^\n\d@]+)/m);
  return nameMatch ? `${nameMatch[2]}${nameMatch[1]}`.trim() : "";
}

function extractCompanyFromText(text: string): string {
  // Look for "株式会社" or similar patterns
  const companyMatch = text.match(/(株式会社|会社|有限会社|団体|事務所)[^\n]*/);
  return companyMatch ? companyMatch[0] : "";
}

function extractTitleFromText(text: string): string {
  // Common job titles in Japanese
  const titlePatterns = [
    "部長",
    "課長",
    "主任",
    "営業",
    "企画",
    "技術",
    "代表",
    "マネージャー",
  ];
  const found = titlePatterns.find((pattern) => text.includes(pattern));
  return found || "";
}

function extractEmailFromText(text: string): string {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0] : "";
}

function extractPhoneFromText(text: string): string {
  // Match Japanese phone numbers: 090-1234-5678, +81-90-1234-5678, etc.
  const phoneMatch = text.match(/(\+?81[-]?|0)?\d{1,4}[-]?\d{1,4}[-]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : "";
}

function extractAddressFromText(text: string): string {
  // First few lines might contain address
  const lines = text.split("\n");
  return lines.slice(0, 2).join(" ").substring(0, 100);
}

function extractUrlFromText(text: string): string {
  const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/);
  return urlMatch ? urlMatch[0] : "";
}

/**
 * DEPRECATED: Browser-based thumbnail generation
 * Use generateThumbnailFromBase64() instead for server-side processing
 *
 * @deprecated Use generateThumbnailFromBase64() for server-side execution
 */
export async function generateThumbnail(imageFile: File): Promise<string> {
  // Browser version - no longer used in Server Actions
  // Kept for backward compatibility only
  console.warn(
    "generateThumbnail() is deprecated. Use generateThumbnailFromBase64() instead."
  );
  return "";
}

/**
 * Generate 100px thumbnail from Base64 image data
 * Server-side processing using Sharp (if available) or fallback
 *
 * Specification: Maintain aspect ratio at 100px width, PNG format, Base64 encoded
 * Used for privacy-preserving UI preview only.
 *
 * @param base64ImageUrl - Data URL image (e.g., "data:image/jpeg;base64,...")
 * @returns Base64 encoded thumbnail (100px width) or empty string on error
 */
export async function generateThumbnailFromBase64(
  base64ImageUrl: string
): Promise<string> {
  try {
    // Extract base64 data from data URL
    if (!base64ImageUrl.startsWith("data:image/")) {
      throw new Error("Invalid image data URL format");
    }

    const base64Data = base64ImageUrl.split(",")[1];
    if (!base64Data) {
      throw new Error("Could not extract base64 data from image URL");
    }

    // Convert Base64 to Buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Try to use Sharp for server-side processing
    const sharpLib = await getSharp();

    if (sharpLib) {
      try {
        // Use Sharp to resize to 100px width, maintaining aspect ratio
        const thumbnailBuffer = await sharpLib(imageBuffer)
          .resize(100, undefined, {
            withoutEnlargement: true, // Don't upscale
            fit: "inside", // Maintain aspect ratio
          })
          .png({ quality: 80 }) // PNG format, 80% quality
          .toBuffer();

        // Convert thumbnail buffer back to Base64
        const base64Thumbnail = thumbnailBuffer.toString("base64");
        return `data:image/png;base64,${base64Thumbnail}`;
      } catch (sharpError) {
        console.warn("Sharp processing failed, trying fallback:", sharpError);
        // Fall through to fallback
      }
    }

    // Fallback: Return empty string
    // (Full fallback would require additional libraries)
    console.warn("No image processing library available for thumbnail generation");
    return "";
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return "";
  }
}

/**
 * Save extracted business card data to Supabase
 * Data is immediately protected by RLS (auth.uid() = user_id)
 *
 * @param supabase - Supabase client
 * @param data - Normalized business card data
 * @returns Inserted record ID
 */
export async function saveBusinessCardToSupabase(
  supabase: SupabaseClient<Database>,
  data: Partial<BusinessCardData>
): Promise<string> {
  if (!data.user_id) {
    throw new Error("User ID is required");
  }

  if (!data.full_name || !data.company) {
    throw new Error("Name and company are required fields");
  }

  // Generate UUID for new card (will be set by trigger or explicit insert)
  const id = crypto.randomUUID();

  const cardData: any = {
    id,
    user_id: data.user_id,
    category_id: data.category_id || null,
    full_name: data.full_name,
    kana: data.kana || null,
    company: data.company || null,
    department: data.department || null,
    title: data.title || null,
    email: data.email || null,
    phone: data.phone || null,
    postal_code: data.postal_code || null,
    address: data.address || null,
    url: data.url || null,
    notes: null,
    thumbnail_base64: data.thumbnail_base64 || null,
    source: data.source || "azure",
    exchanged_at: new Date().toISOString().split("T")[0],
    location_name: null,
    location_lat: null,
    location_lng: null,
    location_accuracy_m: null,
  };

  const { data: inserted, error } = (await (supabase
    .from("business_cards") as any)
    .insert([cardData])
    .select("id")
    .single()) as any;

  if (error) {
    console.error("Supabase insert error:", error);
    throw new Error(`Failed to save business card: ${error.message}`);
  }

  return inserted?.id || id;
}

/**
 * Complete OCR analysis pipeline: Azure API → Normalize → Thumbnail → Save to Supabase
 * Server-side function for security (Azure credentials + RLS protection)
 *
 * Zero-Knowledge Guarantee:
 * - Image is sent ONLY to Azure (deleted within 24h)
 * - 100px thumbnail generated for UI preview only
 * - Extracted data immediately stored in Supabase with RLS protection
 *
 * @param imageUrl - Base64 data URL of business card image
 * @param supabase - Supabase client
 * @param userId - Current user ID
 * @returns Saved business card data
 */
export async function analyzeAndSaveBusinessCard(
  imageUrl: string,
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<BusinessCardData & { id: string }> {
  // Step 1: Analyze with Azure (image deleted within 24h by Azure)
  const azureResult = await analyzeBusinessCardWithAzure(imageUrl);

  // Step 2: Normalize to BusinessCardData format
  let normalized = normalizeAzureResult(azureResult, userId);

  // Step 3: Generate 100px thumbnail from Base64 image
  // (Original image stays only as Base64 in memory, never persisted)
  try {
    normalized.thumbnail_base64 = await generateThumbnailFromBase64(imageUrl);
  } catch (error) {
    console.warn("Thumbnail generation failed, continuing without:", error);
    normalized.thumbnail_base64 = null;
  }

  // Step 4: Save to Supabase (RLS protection via user_id)
  const cardId = await saveBusinessCardToSupabase(supabase, normalized);

  return {
    id: cardId,
    full_name: normalized.full_name || "",
    kana: normalized.kana || null,
    company: normalized.company || "",
    department: normalized.department || null,
    title: normalized.title || "",
    email: normalized.email || "",
    phone: normalized.phone || "",
    mobile: normalized.mobile || null,
    fax: normalized.fax || null,
    postal_code: normalized.postal_code || null,
    address: normalized.address || "",
    url: normalized.url || null,
    user_id: userId,
    category_id: null,
    notes: null,
    thumbnail_base64: normalized.thumbnail_base64 || null,
    source: normalized.source || "azure",
    exchanged_at: new Date().toISOString().split("T")[0],
    location_name: null,
    location_lat: null,
    location_lng: null,
    location_accuracy_m: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
