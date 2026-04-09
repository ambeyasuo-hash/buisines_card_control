// (c) 2026 ambe / Business_Card_Folder
// Server Action: Azure OCR Analysis and Supabase Storage

"use server";

import { createClient } from "@supabase/supabase-js";
import { analyzeAndSaveBusinessCard } from "@/lib/azure-ocr";
import type { BusinessCardData } from "@/types/business-card";
import type { Database } from "@/types/database";

/**
 * Server Action: Analyze business card and save to Supabase
 *
 * Security guarantees:
 * - Runs on server-side only (Azure credentials never exposed)
 * - Returns data protected by RLS (current user only)
 * - Image is converted to Base64 and sent to Azure Japan East
 * - PII stored in Supabase with RLS protection
 *
 * @param fileData - Base64 encoded image from client
 * @param accessToken - Current user's access token from auth
 * @returns Saved business card data or error message
 */
export async function analyzeBusinessCardAction(
  fileData: string,
  accessToken: string
): Promise<{
  success: boolean;
  data?: BusinessCardData & { id: string };
  error?: string;
}> {
  try {
    // Initialize Supabase client with user auth token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: "Supabase credentials not configured",
      };
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "ログインが必要です。",
      };
    }

    // Validate image data
    if (!fileData || !fileData.startsWith("data:image/")) {
      return {
        success: false,
        error: "無効な画像形式です。",
      };
    }

    // Call Azure OCR pipeline
    // Image is sent ONLY to Azure (Japan East)
    // Data is immediately saved to Supabase with RLS protection
    const result = await analyzeAndSaveBusinessCard(
      fileData, // Base64 image
      supabase,
      user.id
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("OCR action error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "解析に失敗しました。";

    return {
      success: false,
      error: errorMessage,
    };
  }
}
