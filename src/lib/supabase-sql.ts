/**
 * Supabase Business Card Database Schema
 * SQL generation for v5.0.6 design system
 * Includes RLS policies and encrypted data structure
 */

/**
 * Generate CREATE TABLE SQL for business_cards
 * Designed for v5.0.6+ with OCR two-phase scanning (front + back)
 * Includes encrypted data, search indexing, categorization, and full-text metadata
 */
export function generateBusinessCardsTableSQL(): string {
  return `-- Create business_cards table with full v5.0.6+ schema
-- Two-phase OCR: front (name, company, etc.) + back (full-text notes)
-- Includes RLS policies and metadata for dashboard filtering

CREATE TABLE IF NOT EXISTS business_cards (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_id は Supabase Auth 使用時のみ設定。匿名利用時は NULL 許容
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- E2EE: クライアント側 AES-256-GCM で暗号化済みデータ (PII を含む)
  -- フォーマット: "v1:<iv_base64>:<ciphertext_base64>"
  encrypted_data TEXT NOT NULL,

  -- Encryption metadata (for future key rotation)
  encryption_key_id TEXT NOT NULL DEFAULT 'v1',

  -- Blind search hashes (平文だが PII は含まない)
  -- 企業名・氏名を小文字正規化したハッシュ
  search_hashes TEXT[] NOT NULL DEFAULT '{}',

  -- Categorization for dashboard filtering
  industry_category TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE,

  -- OCR metadata
  ocr_confidence FLOAT,

  -- Thumbnail (optional, card image preview)
  thumbnail_url TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_business_cards_user_id
  ON business_cards(user_id);

CREATE INDEX IF NOT EXISTS idx_business_cards_created_at
  ON business_cards(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_cards_search_hashes
  ON business_cards USING GIN(search_hashes);

CREATE INDEX IF NOT EXISTS idx_business_cards_industry
  ON business_cards(industry_category);

-- Full-text search index on back-side notes (裏面テキスト検索用)
-- Optional: Use tsvector for advanced full-text search
-- CREATE INDEX IF NOT EXISTS idx_business_cards_notes_fts
--   ON business_cards USING GIN(to_tsvector('japanese', COALESCE(notes, '')));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_business_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_business_cards_updated_at
BEFORE UPDATE ON business_cards
FOR EACH ROW
EXECUTE FUNCTION update_business_cards_updated_at();

-- ═══ ROW LEVEL SECURITY (RLS) ═══
-- Enable RLS
ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;

-- ── Zero-Knowledge 匿名利用モード (Supabase Auth 不使用) ──
-- データは全て端末内で暗号化済みのため、anon キーでの読み書きを許可
-- 本番環境で Supabase Auth を使用する場合は下記コメントアウトを切り替える

-- Policy: 匿名ユーザーも INSERT 可能 (暗号化済みデータのみ)
CREATE POLICY "Anon can insert encrypted cards"
  ON business_cards FOR INSERT
  WITH CHECK (true);

-- Policy: 匿名ユーザーも SELECT 可能 (暗号文のみ返る = 端末キーがないと読めない)
CREATE POLICY "Anon can view cards"
  ON business_cards FOR SELECT
  USING (true);

-- Policy: 匿名ユーザーも UPDATE 可能
CREATE POLICY "Anon can update cards"
  ON business_cards FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: 匿名ユーザーも DELETE 可能
CREATE POLICY "Anon can delete cards"
  ON business_cards FOR DELETE
  USING (true);

-- ── Supabase Auth 使用時はこちらに切り替え ──
-- DROP POLICY IF EXISTS "Anon can insert encrypted cards" ON business_cards;
-- DROP POLICY IF EXISTS "Anon can view cards" ON business_cards;
-- DROP POLICY IF EXISTS "Anon can update cards" ON business_cards;
-- DROP POLICY IF EXISTS "Anon can delete cards" ON business_cards;
-- CREATE POLICY "Users can view their own cards"   ON business_cards FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert their own cards" ON business_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update their own cards" ON business_cards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can delete their own cards" ON business_cards FOR DELETE USING (auth.uid() = user_id);

-- ═══ GRANTS ═══
-- anon ロールに読み書き許可 (Zero-Knowledge モード)
GRANT SELECT, INSERT, UPDATE, DELETE ON business_cards TO anon;

-- Authenticated users (Supabase Auth 使用時)
GRANT SELECT, INSERT, UPDATE, DELETE ON business_cards TO authenticated;

-- Service role (for admin operations) has full access
GRANT ALL ON business_cards TO service_role;`;
}

/**
 * Extract project ID from Supabase URL
 * Example: https://abc123.supabase.co → abc123
 */
export function extractProjectIdFromUrl(supabaseUrl: string): string {
  try {
    const url = new URL(supabaseUrl);
    const [projectId] = url.hostname.split('.');
    return projectId;
  } catch {
    return '';
  }
}

/**
 * Generate Supabase SQL Editor URL
 * Opens SQL editor at: https://supabase.com/dashboard/project/{projectId}/sql/new
 */
export function generateSQLEditorUrl(supabaseUrl: string): string {
  const projectId = extractProjectIdFromUrl(supabaseUrl);
  if (!projectId) {
    return 'https://supabase.com/dashboard'; // fallback to dashboard
  }
  return `https://supabase.com/dashboard/project/${projectId}/sql/new`;
}

/**
 * Generate sample INSERT query for testing
 */
export function generateSampleInsertSQL(): string {
  return `-- Sample INSERT (for testing after table creation)
INSERT INTO business_cards (
  user_id,
  encrypted_data,
  search_hashes,
  industry_category,
  attributes
) VALUES (
  auth.uid(),
  'encrypted:...',
  ARRAY['hash1', 'hash2'],
  'Technology',
  '{"source": "scan", "ocr_provider": "azure"}'::jsonb
);`;
}

/**
 * Generate verification query
 */
export function generateVerificationSQL(): string {
  return `-- Verify table creation and RLS policies
SELECT * FROM information_schema.tables
WHERE table_name = 'business_cards';

-- List RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'business_cards';

-- Test select (should return 0 rows on first run)
SELECT COUNT(*) FROM business_cards;`;
}
