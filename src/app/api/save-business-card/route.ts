/**
 * Save Encrypted Business Card — サーバーサイドプロキシ
 *
 * Zero-Knowledge Architecture:
 *   - サーバーは PII（氏名・連絡先等）を一切受け取らない
 *   - クライアントが端末内で AES-256-GCM 暗号化したデータのみを受け取り
 *   - Supabase の encrypted_data カラムに暗号文を格納する薄いプロキシとして動作
 *   - Supabase URL / Anon Key もリクエストボディから受け取る（環境変数不使用）
 *
 * POST /api/save-business-card
 * Body: {
 *   encrypted_data: string      // "v1:<iv>:<ciphertext>" — クライアント側暗号化済み
 *   encryption_key_id?: string  // キーバージョン (default: 'v1')
 *   search_hashes?: string[]    // ブラインド検索ハッシュ (PII なし)
 *   industry_category?: string
 *   scanned_at?: string         // ISO timestamp
 *   thumbnail_url?: string      // サムネイル画像 (オプション)
 *   ocr_confidence?: number
 *   supabaseUrl: string         // 端末 localStorage から転送
 *   supabaseKey: string         // 端末 localStorage から転送
 * }
 * Response: { ok: boolean, id?: string, error?: string }
 */

import { createClient } from '@supabase/supabase-js';

interface SaveRequest {
  encrypted_data: string;
  encryption_key_id?: string;
  search_hashes?: string[];
  industry_category?: string;
  scanned_at?: string;
  thumbnail_url?: string;
  ocr_confidence?: number;
  // Supabase credentials passed from client localStorage
  supabaseUrl: string;
  supabaseKey: string;
}

interface SaveResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as SaveRequest;

    const { encrypted_data, supabaseUrl, supabaseKey } = body;

    // ─── Validation ────────────────────────────────────────────────────────────

    if (!encrypted_data) {
      return Response.json(
        { ok: false, error: '暗号化データがありません' } as SaveResponse,
        { status: 400 },
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        {
          ok: false,
          error: 'Supabase の設定がありません。\n\n設定画面で URL と Anon Key を入力して保存してください。',
        } as SaveResponse,
        { status: 400 },
      );
    }

    // ─── Supabase client (client-provided credentials) ────────────────────────
    const supabase = createClient(
      supabaseUrl.trim().replace(/\/$/, ''),
      supabaseKey.trim(),
    );

    // ─── INSERT (暗号文のみ — PII はサーバーに一切渡らない) ─────────────────────
    const { data, error } = await supabase
      .from('business_cards')
      .insert({
        encrypted_data:    encrypted_data,
        encryption_key_id: body.encryption_key_id ?? 'v1',
        search_hashes:     body.search_hashes     ?? [],
        industry_category: body.industry_category ?? null,
        scanned_at:        body.scanned_at        ?? new Date().toISOString(),
        thumbnail_url:     body.thumbnail_url      ?? null,
        ocr_confidence:    body.ocr_confidence     ?? null,
        // attributes / notes / ocr_raw_text は encrypted_data に内包済みのため省略
      })
      .select('id')
      .single();

    if (error) {
      // RLS / 認証エラーの分かりやすいメッセージ
      if (error.code === '42501' || error.message.includes('policy')) {
        return Response.json(
          {
            ok: false,
            error: 'Supabase の RLS ポリシーでブロックされました。\n\n設定画面の「SQLをコピー」から初期化SQLを実行してポリシーを確認してください。',
          } as SaveResponse,
          { status: 200 },
        );
      }

      if (error.code === '42P01') {
        return Response.json(
          {
            ok: false,
            error: 'business_cards テーブルが存在しません。\n\n設定画面の「SQLをコピー」から初期化SQLを実行してください。',
          } as SaveResponse,
          { status: 200 },
        );
      }

      return Response.json(
        {
          ok: false,
          error: `データベースへの保存に失敗しました。\n\n${error.message}`,
        } as SaveResponse,
        { status: 200 },
      );
    }

    return Response.json(
      { ok: true, id: data?.id } as SaveResponse,
      { status: 200 },
    );

  } catch (err) {
    const error = err as Error;
    return Response.json(
      {
        ok: false,
        error: '名刺の保存中にエラーが発生しました。\n\nもう一度お試しください。',
      } as SaveResponse,
      { status: 500 },
    );
  }
}
