/**
 * Save Business Card OCR Result to Supabase
 *
 * POST /api/save-business-card
 * Body: {
 *   name?: string
 *   company?: string
 *   title?: string
 *   email?: string
 *   tel?: string
 *   address?: string
 *   notes?: string         // Back-side full text
 *   raw?: string           // OCR raw text
 *   thumbnail?: string     // Base64 image
 *   scannedAt?: string     // ISO timestamp
 * }
 *
 * Response: { ok: boolean, id?: string, error?: string }
 */

import { createClient } from '@supabase/supabase-js';

interface SaveRequest {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  tel?: string;
  address?: string;
  notes?: string;
  raw?: string;
  thumbnail?: string;
  scannedAt?: string;
}

interface SaveResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as SaveRequest;

    // Supabase 設定を環境変数から読む (Vercel 本番環境)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json(
        {
          ok: false,
          error: 'Supabase の設定がサーバーで見つかりません。\n\nVercel 環境変数を確認してください。',
        } as SaveResponse,
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ─── Prepare data for insertion ────────────────────────────────────
    // business_cards テーブルのスキーマに合わせてデータを整形
    const now = new Date().toISOString();
    const scannedAt = body.scannedAt ?? now;

    // 基本フィールド (JSON として attributes に格納)
    const attributes = {
      name: body.name ?? null,
      company: body.company ?? null,
      title: body.title ?? null,
      email: body.email ?? null,
      tel: body.tel ?? null,
      address: body.address ?? null,
    };

    // 検索ハッシュ (company + name の組み合わせで簡易検索インデックス)
    const searchTokens: string[] = [];
    if (body.company) searchTokens.push(body.company.toLowerCase());
    if (body.name) searchTokens.push(body.name.toLowerCase());

    // ─── Insert into business_cards ────────────────────────────────────
    const { data, error } = await supabase.from('business_cards').insert({
      // スキーマ確認: ocr_raw_text, notes, thumbnail_url, scanned_at, attributes
      ocr_raw_text: body.raw ?? null,         // 表面 OCR 生テキスト
      notes: body.notes ?? null,               // 裏面全文テキスト
      thumbnail_url: body.thumbnail ?? null,   // サムネイル base64
      scanned_at: scannedAt,                   // 撮影時刻
      attributes: attributes,                  // 抽出フィールド (JSON)
      search_hashes: searchTokens.length > 0 ? searchTokens : null,
      industry_category: null,                 // オプション
      ocr_confidence: null,                    // Azure 信頼度 (今回は未使用)
    }).select('id').single();

    if (error) {
      console.error('[SaveBusinessCard] Supabase insert error:', error);
      return Response.json(
        {
          ok: false,
          error: `データベースへの保存に失敗しました。\n\n${error.message}`,
        } as SaveResponse,
        { status: 500 },
      );
    }

    return Response.json(
      {
        ok: true,
        id: data?.id,
      } as SaveResponse,
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('[SaveBusinessCard] Error:', error.message);
    return Response.json(
      {
        ok: false,
        error: '名刺の保存中にエラーが発生しました。\n\nもう一度お試しください。',
      } as SaveResponse,
      { status: 500 },
    );
  }
}
