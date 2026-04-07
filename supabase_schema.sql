-- (c) 2026 ambe / Business_Card_Folder

-- ============================================================
-- 0. ユーザー設定テーブル（Auth一元化: Gemini API Key 同期用）
-- ============================================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gemini_api_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: 本人のみ読み書き可能
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings: select own"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings: insert own"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings: update own"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 1. カテゴリテーブル
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_hex TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories: select own" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories: insert own" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: update own" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories: delete own" ON categories FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. 名刺データテーブル
-- ============================================================
CREATE TABLE business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  thumbnail_base64 TEXT,  -- 100px幅の超軽量base64サムネイルのみ保持（案A）

  -- 現場ログ
  notes TEXT,
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_accuracy_m REAL,
  source TEXT DEFAULT 'camera', -- camera, line, manual
  exchanged_at DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_cards: select own" ON business_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "business_cards: insert own" ON business_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "business_cards: update own" ON business_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "business_cards: delete own" ON business_cards FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. お礼メールログ
-- ============================================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES business_cards(id) ON DELETE CASCADE,
  generated_body TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_logs: select own" ON email_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM business_cards bc WHERE bc.id = email_logs.card_id AND bc.user_id = auth.uid()));
CREATE POLICY "email_logs: insert own" ON email_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM business_cards bc WHERE bc.id = email_logs.card_id AND bc.user_id = auth.uid()));
CREATE POLICY "email_logs: delete own" ON email_logs FOR DELETE
  USING (EXISTS (SELECT 1 FROM business_cards bc WHERE bc.id = email_logs.card_id AND bc.user_id = auth.uid()));
