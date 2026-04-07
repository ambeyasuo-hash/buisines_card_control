// (c) 2026 ambe / Business_Card_Folder

export type BYOConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
};

export type Category = {
  id: string;
  name: string;
  color_hex: string;
};

export type BusinessCard = {
  id: string;
  category_id?: string;
  full_name: string;
  kana?: string;
  company?: string;
  department?: string;
  title?: string;
  email?: string;
  phone?: string;
  postal_code?: string;
  address?: string;
  url?: string;
  thumbnail_base64?: string;
  notes?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_accuracy_m?: number;
  source: 'camera' | 'line' | 'manual';
  exchanged_at: string;
  created_at: string;
};

export type CardOCRResult = {
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
  thumbnail_base64?: string;
};
