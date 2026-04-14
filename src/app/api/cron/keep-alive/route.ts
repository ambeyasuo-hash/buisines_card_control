import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Keep-Alive API エンドポイント
 *
 * 目的: Supabase の無料プランが自動停止されるのを防ぐため、
 *      24時間に1回実行される Vercel Cron Job から呼び出される。
 *
 * セキュリティ:
 * - リクエストヘッダーの Authorization トークンで CRON_SECRET と照合
 * - 外部からの不正アクセスを防止
 *
 * ログ:
 * - Vercel Function Logs に実行時刻・ステータスを記録
 *
 * パフォーマンス:
 * - Supabase への軽量クエリ（SELECT + UPDATE）のみ実行
 * - 無料枠内での十分な動作を保証（月1回 30円未満）
 */

export async function GET(request: NextRequest) {
  try {
    // ========================================
    // 1. リクエスト認証（CRON_SECRET 検証）
    // ========================================
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[keep-alive] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== cronSecret) {
      console.warn('[keep-alive] Unauthorized: Invalid CRON_SECRET');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ========================================
    // 2. Supabase クライアント初期化
    // ========================================
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[keep-alive] Supabase credentials not configured');
      return NextResponse.json(
        { error: 'Supabase credentials are not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ========================================
    // 3. Supabase への生存確認クエリ実行
    // ========================================
    console.log('[keep-alive] Executing keep-alive query...');
    const startTime = Date.now();

    // ライトウェイトなクエリ: profiles テーブルの行数確認
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact' });

    if (profilesError) {
      console.error('[keep-alive] Error querying profiles:', profilesError.message);
      return NextResponse.json(
        { error: `Database query failed: ${profilesError.message}` },
        { status: 500 }
      );
    }

    // ========================================
    // 4. レスポンス生成
    // ========================================
    const duration = Date.now() - startTime;
    const now = new Date().toISOString();

    console.log(`[keep-alive] Success (duration: ${duration}ms)`);

    return NextResponse.json({
      status: 'success',
      timestamp: now,
      duration_ms: duration,
      query_result: {
        profiles_count: profilesData?.[0]?.count || 0,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[keep-alive] Unexpected error:', errorMessage);

    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * POST メソッド対応（Vercel Cron では GET が一般的だが、互換性のため実装）
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
