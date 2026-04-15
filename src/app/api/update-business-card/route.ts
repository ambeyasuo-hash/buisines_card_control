/**
 * Update Encrypted Business Card — サーバーサイドプロキシ
 *
 * Zero-Knowledge Architecture:
 *   - サーバーは PII（氏名・連絡先等）を一切受け取らない
 *   - クライアントが端末内で AES-256-GCM 暗号化したデータのみを受け取り
 *   - Supabase の encrypted_data カラムを更新する薄いプロキシとして動作
 *
 * POST /api/update-business-card
 * Body: {
 *   cardId: string              // 更新対象のカード ID
 *   encrypted_data: string      // "v1:<iv>:<ciphertext>" — クライアント側暗号化済み
 *   encryption_key_id?: string  // キーバージョン (default: 'v1')
 *   search_hashes?: string[]    // ブラインド検索ハッシュ (PII なし)
 *   supabaseUrl: string         // 端末 localStorage から転送
 *   supabaseKey: string         // 端末 localStorage から転送
 * }
 * Response: { ok: boolean, error?: string }
 */

import { createClient } from '@supabase/supabase-js';

interface UpdateRequest {
  cardId: string;
  encrypted_data: string;
  encryption_key_id?: string;
  search_hashes?: string[];
  supabaseUrl: string;
  supabaseKey: string;
}

interface UpdateResponse {
  ok: boolean;
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as UpdateRequest;

    const { cardId, encrypted_data, supabaseUrl, supabaseKey } = body;

    // ─── Validation ────────────────────────────────────────────────────────────

    if (!cardId) {
      return Response.json(
        { ok: false, error: 'カード ID がありません' } as UpdateResponse,
        { status: 400 },
      );
    }

    if (!encrypted_data) {
      return Response.json(
        { ok: false, error: '暗号化データがありません' } as UpdateResponse,
        { status: 400 },
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        {
          ok: false,
          error: 'Supabase の設定がありません。\n\n設定画面で URL と Anon Key を入力して保存してください。',
        } as UpdateResponse,
        { status: 400 },
      );
    }

    // ─── Supabase client (client-provided credentials) ────────────────────────
    const supabase = createClient(
      supabaseUrl.trim().replace(/\/$/, ''),
      supabaseKey.trim(),
    );

    // ─── UPDATE (暗号文のみ — PII はサーバーに一切渡らない) ──────────────────────
    const { error } = await supabase
      .from('business_cards')
      .update({
        encrypted_data: encrypted_data,
        encryption_key_id: body.encryption_key_id ?? 'v1',
        search_hashes: body.search_hashes ?? [],
      })
      .eq('id', cardId);

    if (error) {
      // RLS / 認証エラーの分かりやすいメッセージ
      if (error.code === '42501' || error.message.includes('policy')) {
        return Response.json(
          {
            ok: false,
            error: 'Supabase の RLS ポリシーでブロックされました。',
          } as UpdateResponse,
          { status: 200 },
        );
      }

      return Response.json(
        {
          ok: false,
          error: `データベースの更新に失敗しました。\n\n${error.message}`,
        } as UpdateResponse,
        { status: 200 },
      );
    }

    return Response.json(
      { ok: true } as UpdateResponse,
      { status: 200 },
    );

  } catch (err) {
    const error = err as Error;
    return Response.json(
      {
        ok: false,
        error: '名刺の更新中にエラーが発生しました。\n\nもう一度お試しください。',
      } as UpdateResponse,
      { status: 500 },
    );
  }
}
