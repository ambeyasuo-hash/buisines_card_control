// (c) 2026 ambe / Business_Card_Folder
// Business Card Data Model & Type Definitions

/**
 * OCR extraction result from Azure AI Document Intelligence
 * Prebuilt Business Card model (ja-JP locale)
 */
export interface AzureBusinessCardResult {
  // Contact Information
  contactNames?: AzureContactName[];
  emails?: AzureValueField[];
  phoneNumbers?: AzureValueField[];
  websites?: AzureValueField[];

  // Organization
  companyNames?: AzureValueField[];
  departments?: AzureValueField[];
  jobTitles?: AzureValueField[];

  // Address
  addresses?: AzureValueField[];
  postalCodes?: AzureValueField[];

  // Additional
  faxNumbers?: AzureValueField[];
  mobilePhones?: AzureValueField[];
}

/**
 * Azure SDK response field with confidence score
 */
export interface AzureValueField {
  content?: string;
  confidence?: number;
  boundingRegions?: AzureBoundingRegion[];
  spans?: AzureSpan[];
}

/**
 * Contact name broken down into parts
 */
export interface AzureContactName extends AzureValueField {
  firstName?: AzureValueField;
  lastName?: AzureValueField;
  middleName?: AzureValueField;
  suffix?: AzureValueField;
}

/**
 * Bounding region (2D coordinates)
 */
export interface AzureBoundingRegion {
  pageNumber?: number;
  polygon?: AzurePoint[];
}

export interface AzurePoint {
  x?: number;
  y?: number;
}

/**
 * Span information (character position in source)
 */
export interface AzureSpan {
  offset?: number;
  length?: number;
}

/**
 * Normalized Business Card Data
 * Extracted from Azure AI result and stored in Supabase
 */
export interface BusinessCardData {
  // Identifiers
  id: string; // UUID
  user_id: string; // UUID from auth.users
  category_id?: string | null; // UUID from categories table

  // Name
  full_name: string; // "太郎 田中" (combined)
  kana?: string | null; // Furigana/reading (e.g., "たろう たなか")

  // Organization
  company: string; // Company name
  department?: string | null; // Department
  title: string; // Job title (e.g., "営業部長")

  // Contact
  email: string; // Primary email
  phone: string; // Primary phone number
  mobile?: string | null; // Mobile phone
  fax?: string | null; // Fax number

  // Address
  postal_code?: string | null; // Postal code (e.g., "100-0005")
  address: string; // Full address

  // Web
  url?: string | null; // Website URL

  // Metadata
  notes?: string | null; // User notes (JSON or plain text)
  thumbnail_base64?: string | null; // 100px width, base64 encoded
  source: "azure" | "manual" | "camera"; // OCR source

  // Location
  location_name?: string | null; // City/region name (from Nominatim)
  location_lat?: number | null; // Latitude
  location_lng?: number | null; // Longitude
  location_accuracy_m?: number | null; // Accuracy in meters

  // Timestamps
  exchanged_at?: string; // ISO date (e.g., "2026-04-09")
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * OCR Processing Status
 * Used for UI state management during analysis
 */
export type OCRStatus =
  | { state: "idle" }
  | { state: "uploading"; progress: number }
  | { state: "analyzing"; step: "image" | "azure" | "masking" }
  | {
      state: "success";
      data: BusinessCardData;
      confidence: {
        name: number;
        email: number;
        phone: number;
      };
    }
  | { state: "error"; message: string; recoverable: boolean };

/**
 * Attributes extracted for AI (PII-free)
 * Used for Gemini email template generation
 */
export interface AttributesMasked {
  role: string; // e.g., "営業", "管理", "技術"
  industry: string; // e.g., "商社", "製造", "IT"
  mission?: string; // User-selected category
}

/**
 * Email generation result
 */
export interface GeneratedEmail {
  subject: string; // Email subject with {{placeholders}}
  body: string; // Email body with {{placeholders}}
  variables: string[]; // List of {{variable}} names
}

/**
 * Hydrated email (with actual data merged)
 */
export interface HydratedEmail extends GeneratedEmail {
  subject_rendered: string; // Subject with {{}} replaced
  body_rendered: string; // Body with {{}} replaced
}
