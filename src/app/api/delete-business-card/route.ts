/**
 * Delete Business Card — サーバーサイドプロキシ
 *
 * Zero-Knowledge Architecture:
 *   - サーバーは PII を一切受け取らない
 *   - カード ID のみでレコード削除を実行する
 *   - 削除は完全で、クライアント側でのセキュア削除は不要
 *
 * POST /api/delete-business-card
 * Body: {
 *   cardId: string              // 削除対象のカード ID
 *   supabaseUrl: string         // 端末 localStorage から転送
 *   supabaseKey: string         // 端末 localStorage から転送
 * }
 * Response: { ok: boolean, error?: string }
 */

import { createClient } from '@supabase/supabase-js';

interface DeleteRequest {
  cardId: string;
  supabaseUrl: string;
  supabaseKey: string;
}

interface DeleteResponse {
  ok: boolean;
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as DeleteRequest;

    const { cardId, supabaseUrl, supabaseKey } = body;

    // ─── Validation ────────────────────────────────────────────────────────────

    if (!cardId) {
      return Response.json(
        { ok: false, error: 'カード ID がありません' } as DeleteResponse,
        { status: 400 },
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        {
          ok: false,
          error: 'Supabase の設定がありません。',
        } as DeleteResponse,
        { status: 400 },
      );
    }

    // ─── Supabase client (client-provided credentials) ────────────────────────
    const supabase = createClient(
      supabaseUrl.trim().replace(/\/$/, ''),
      supabaseKey.trim(),
    );

    // ─── DELETE (カード ID のみでレコード削除) ──────────────────────────────────
    const { error } = await supabase
      .from('business_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      // RLS / 認証エラーの分かりやすいメッセージ
      if (error.code === '42501' || error.message.includes('policy')) {
        return Response.json(
          {
            ok: false,
            error: 'Supabase の RLS ポリシーでブロックされました。',
          } as DeleteResponse,
          { status: 200 },
        );
      }

      return Response.json(
        {
          ok: false,
          error: `データベースからの削除に失敗しました。\n\n${error.message}`,
        } as DeleteResponse,
        { status: 200 },
      );
    }

    return Response.json(
      { ok: true } as DeleteResponse,
      { status: 200 },
    );

  } catch (err) {
    const error = err as Error;
    return Response.json(
      {
        ok: false,
        error: '名刺の削除中にエラーが発生しました。\n\nもう一度お試しください。',
      } as DeleteResponse,
      { status: 500 },
    );
  }
}
