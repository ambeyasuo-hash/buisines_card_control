// (c) 2026 ambe / Business_Card_Folder

/**
 * Supabase テーブル定義
 *
 * テーブル:
 *   0. user_settings   — ユーザー設定（Gemini API Key 等）Auth一元化
 *   1. business_cards  — OCR済み名刺データ
 *   2. categories      — カテゴリマスター
 *   3. email_logs      — お礼メール生成ログ
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          gemini_api_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gemini_api_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["user_settings"]["Insert"], "user_id">>;
      };
      business_cards: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          full_name: string;
          kana: string | null;
          company: string | null;
          department: string | null;
          title: string | null;
          email: string | null;
          phone: string | null;
          postal_code: string | null;
          address: string | null;
          url: string | null;
          thumbnail_base64: string | null;
          notes: string | null;
          location_name: string | null;
          location_lat: number | null;
          location_lng: number | null;
          location_accuracy_m: number | null;
          source: string;
          exchanged_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["business_cards"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["business_cards"]["Insert"]
        >;
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color_hex: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      email_logs: {
        Row: {
          id: string;
          card_id: string;
          generated_body: string | null;
          sent_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["email_logs"]["Row"], "id" | "sent_at">;
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
