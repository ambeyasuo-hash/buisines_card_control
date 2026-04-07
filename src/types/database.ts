/**
 * Supabase テーブル定義 (4テーブル)
 *
 * テーブル:
 *   1. business_cards  — OCR済み名刺データ
 *   2. card_images     — 名刺画像（Storage パス）
 *   3. tags            — タグマスター
 *   4. card_tags       — 名刺↔タグの中間テーブル
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
      business_cards: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string | null;
          name_kana: string | null;
          company: string | null;
          department: string | null;
          title: string | null;
          email: string | null;
          phone: string | null;
          mobile: string | null;
          address: string | null;
          website: string | null;
          notes: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["business_cards"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["business_cards"]["Insert"]
        >;
      };
      card_images: {
        Row: {
          id: string;
          card_id: string;
          storage_path: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["card_images"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["card_images"]["Insert"]
        >;
      };
      tags: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tags"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["tags"]["Insert"]>;
      };
      card_tags: {
        Row: {
          card_id: string;
          tag_id: string;
        };
        Insert: Database["public"]["Tables"]["card_tags"]["Row"];
        Update: Partial<Database["public"]["Tables"]["card_tags"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
