-- (c) 2026 ambe / Business_Card_Folder

-- 1. カテゴリテーブル
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_hex TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 名刺データテーブル
CREATE TABLE business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- 基本情報
  full_name TEXT NOT NULL,
  kana TEXT,
  company TEXT,
  department TEXT,
  title TEXT,
  
  -- 連絡先・詳細
  email TEXT,
  phone TEXT,
  postal_code TEXT,
  address TEXT,
  url TEXT,
  thumbnail_base64 TEXT,
  
  -- 現場ログ
  notes TEXT,
  location_name TEXT,
  source TEXT DEFAULT 'camera', -- camera, line, manual
  exchanged_at DATE DEFAULT CURRENT_DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. お礼メールログ
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES business_cards(id) ON DELETE CASCADE,
  generated_body TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
