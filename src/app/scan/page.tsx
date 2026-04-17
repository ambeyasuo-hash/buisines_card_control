'use client';

/**
 * 名刺スキャンページ v2 — 横持ち (Landscape) 最適化 + 裏面統合パイプライン
 *
 * レイアウト: flex-row
 *   ├─ メインエリア (flex-1) … カメラ映像 / プレビュー / 解析結果
 *   └─ サイドバー (112px)   … ヘッダー / シャッター / アクションボタン
 *
 * 撮影フロー:
 *   表面スキャン → OCR結果表示 → 「裏面も撮影」→ 裏面スキャン → 統合結果
 *
 * 画像処理はすべてサーバー側 (/api/azure/analyze) で完結:
 *   フルフレーム + クロップ座標を送信 → サーバーで sharp クロップ + コントラスト最適化
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, RotateCcw, Check, Zap, FlipHorizontal2,
  User, Building2, Phone, Mail, MapPin, Briefcase,
  AlertCircle, ScanLine, FileText, ChevronRight, Lock,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { decryptData } from '@/lib/crypto';
import { session, type SessionState } from '@/lib/auth-session';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanPhase = 'front' | 'back';
type ScanState =
  | 'initializing'
  | 'ready'
  | 'scanning'
  | 'preview'
  | 'analyzing'
  | 'result';

interface CropRegion { x: number; y: number; w: number; h: number; }

interface CapturePayload {
  imageBase64: string;  // フルフレーム base64
  cropRegion:  CropRegion;  // キャプチャ座標系でのクロップ範囲
}

interface OcrResult {
  name?:    string;
  company?: string;
  title?:   string;
  email?:   string;
  tel?:     string;
  address?: string;
  raw?:     string;
  error?:   string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** 名刺縦横比 91mm × 55mm ≈ 1.655 (横持ちで width > height) */
const CARD_RATIO        = 91 / 55;
/** ガイド枠の高さをビューポート高さに対して何割にするか */
const GUIDE_HEIGHT_RATIO = 0.72;
/** サムネイルの幅 */
const THUMB_W = 240;

const LS_AZURE = {
  endpoint: 'azure_ocr_endpoint',
  key:      'azure_ocr_key',
} as const;

// ─── ScanPage (Main) ──────────────────────────────────────────────────────────

export default function ScanPage() {
  const router = useRouter();

  // Refs
  const videoRef  = useRef<HTMLVideoElement>(null);
  const guideRef  = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Session state (UNLOCKED = Data Key available)
  const [isSessionUnlocked, setIsSessionUnlocked] = useState(false);

  // Core state
  const [scanState,   setScanState]   = useState<ScanState>('initializing');
  const [scanPhase,   setScanPhase]   = useState<ScanPhase>('front');
  const [isPortrait,  setIsPortrait]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  /**
   * cameraKey をインクリメントするたびにカメラ初期化 useEffect が再実行される。
   * 再撮影・裏面スキャン開始時はこのキーを上げてストリームを確実に再起動する。
   */
  const [cameraKey, setCameraKey] = useState(0);

  // Capture & result data
  const [thumbnail,      setThumbnail]      = useState<string | null>(null);
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(null);
  const [frontResult,    setFrontResult]    = useState<OcrResult | null>(null);
  const [backNotes,      setBackNotes]      = useState<string | null>(null);

  // ── 0. Session monitoring ─────────────────────────────────────────
  useEffect(() => {
    setIsSessionUnlocked(session.isUnlocked());
    return session.onStateChange((state: SessionState) => {
      setIsSessionUnlocked(state === 'UNLOCKED');
    });
  }, []);

  // ── 1. Orientation monitoring ─────────────────────────────────────
  // 画面の向きを検知してガイド枠の向きを自動追従
  useEffect(() => {
    const check = () => setIsPortrait(window.innerWidth < window.innerHeight);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // ── 2. Camera initialization (4K優先) ─────────────────────────────────────
  //
  // 依存配列に cameraKey を含めることで、再撮影・裏面スキャン開始時に
  // 旧ストリームの完全停止 → 映像クリア → 新ストリーム取得 の順序を保証する。
  //
  useEffect(() => {
    let cancelled = false;

    // ① 旧ストリームを確実に停止してから映像要素をクリア
    const prev = streamRef.current;
    if (prev) {
      prev.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // ② UI をリセット (cameraKey > 0 の場合 = 再起動)
    if (cameraKey > 0) {
      setCameraReady(false);
      setErrorMsg(null);
      setScanState('initializing');
    }

    const startCamera = async () => {
      try {
        // iOS: 前のカメラセッションが物理的に解放されるまで待機
        // 再起動時 (cameraKey > 0) は 80ms 待機して NotReadableError を防ぐ
        if (cameraKey > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 80));
          if (cancelled) return;
        }

        // 4K → FHD → HD の順にフォールバック
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 3840, min: 1280 },
            height: { ideal: 2160, min: 720 },
          },
          audio: false,
        });

        // キャンセル済み (クリーンアップが先行した場合) はすぐ停止して終了
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // iOS / AnimatePresence: video 要素が DOM にマウントされるまで rAF でリトライ
        // mode="wait" により exit アニメーション完了後にマウントされるため、
        // getUserMedia 完了時点では videoRef.current が null になる場合がある
        const attachStream = (attempt: number) => {
          if (cancelled) {
            // rAF ループ中にクリーンアップが走った場合はストリームを破棄して終了
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            return;
          }
          if (videoRef.current) {
            // iOS Safari: muted を imperatively に設定 (JSX 属性だけでは不十分な場合がある)
            videoRef.current.muted = true;
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { /* onLoadedMetadata でリカバリ */ });
          } else if (attempt < 60) {
            // まだマウントされていない: 次フレームで再試行 (最大 60 回 ≈ 1 秒)
            requestAnimationFrame(() => attachStream(attempt + 1));
          } else {
            // 1 秒経過しても video 要素が現れない場合はエラー表示
            setErrorMsg('カメラの表示に失敗しました。\n\nページを更新してもう一度お試しください。');
            setScanState('ready');
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        };
        requestAnimationFrame(() => attachStream(0));

      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;

        // 再起動失敗時は専用メッセージを出す
        const isRetry = cameraKey > 0;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setErrorMsg('カメラの使用が許可されていません。\n\nブラウザ設定 → カメラ → このサイトに許可してください。');
        } else if (e.name === 'NotFoundError') {
          setErrorMsg('カメラが見つかりません。\n\nカメラ付きデバイスで開いてください。');
        } else if (e.name === 'NotReadableError') {
          setErrorMsg(
            isRetry
              ? 'カメラの再初期化に失敗しました。\n\n前のセッションがまだ解放されていない可能性があります。\nページを更新してもう一度お試しください。'
              : 'カメラが他のアプリで使用中です。\n\nビデオ通話などを終了してから再試行してください。',
          );
        } else {
          setErrorMsg(
            isRetry
              ? 'カメラの再初期化に失敗しました。\n\nページを更新してもう一度お試しください。'
              : 'カメラの起動に失敗しました。\n\nブラウザを再起動してもう一度お試しください。',
          );
        }
        setScanState('ready');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      // クリーンアップ: エフェクトが再実行される前に現在のストリームを停止
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraKey]); // cameraKey が変わるたびに再起動

  const handleVideoReady = useCallback(() => {
    setCameraReady(true);
    setScanState('ready');
  }, []);

  /**
   * カメラを安全に停止してから cameraKey をインクリメントし再起動をトリガーする。
   * resetFull / retake / startBackScan のすべてからこれを使う。
   */
  const restartCamera = useCallback(() => {
    // ストリーム停止は useEffect のクリーンアップに任せず、
    // ここでも即時停止することで二重解放の競合を防ぐ
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setErrorMsg(null);
    // 先に scanState を initializing に戻すことで isCamera = true になり
    // カメラビューが表示されてから getUserMedia が走る (真っ暗防止)
    setScanState('initializing');
    // cameraKey を上げて useEffect を再実行させる
    setCameraKey((k) => k + 1);
  }, []);

  // ── 3. Capture: フルフレーム + クロップ座標をサーバーへ送信 ───────────────
  const capture = useCallback(() => {
    const video = videoRef.current;
    const guide = guideRef.current;
    if (!video || !guide || !cameraReady) return;

    setScanState('scanning');

    // ガイド枠をビデオ内部座標系に変換
    const guideRect = guide.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    if (videoRect.width === 0 || videoRect.height === 0) return;

    const sx = video.videoWidth  / videoRect.width;
    const sy = video.videoHeight / videoRect.height;

    const cropInVideo: CropRegion = {
      x: Math.max(0, Math.round((guideRect.left - videoRect.left) * sx)),
      y: Math.max(0, Math.round((guideRect.top  - videoRect.top)  * sy)),
      w: Math.min(video.videoWidth,  Math.round(guideRect.width  * sx)),
      h: Math.min(video.videoHeight, Math.round(guideRect.height * sy)),
    };

    // フルフレームキャプチャ (最大 2560px 幅に制限してペイロード過大を防ぐ)
    const MAX_W   = 2560;
    const capS    = video.videoWidth > MAX_W ? MAX_W / video.videoWidth : 1;
    const capW    = Math.round(video.videoWidth  * capS);
    const capH    = Math.round(video.videoHeight * capS);
    const fullCvs = document.createElement('canvas');
    fullCvs.width  = capW;
    fullCvs.height = capH;
    fullCvs.getContext('2d')!.drawImage(video, 0, 0, capW, capH);
    const imageBase64 = fullCvs.toDataURL('image/jpeg', 0.94);

    // クロップ座標をキャプチャスケールに合わせて補正
    const cropRegion: CropRegion = {
      x: Math.round(cropInVideo.x * capS),
      y: Math.round(cropInVideo.y * capS),
      w: Math.round(cropInVideo.w * capS),
      h: Math.round(cropInVideo.h * capS),
    };

    // プレビュー用サムネイル (ガイド枠内のみ切り出し)
    const thumbH   = Math.round(cropInVideo.h / Math.max(1, cropInVideo.w) * THUMB_W);
    const thumbCvs = document.createElement('canvas');
    thumbCvs.width  = THUMB_W;
    thumbCvs.height = thumbH;
    thumbCvs.getContext('2d')!.drawImage(
      video,
      cropInVideo.x, cropInVideo.y, cropInVideo.w, cropInVideo.h,
      0, 0, THUMB_W, thumbH,
    );
    const thumbBase64 = thumbCvs.toDataURL('image/jpeg', 0.80);

    setCapturePayload({ imageBase64, cropRegion });
    setThumbnail(thumbBase64);

    // キャプチャ完了後すみやかにカメラストリームを解放 (LEDオフ + 次回再起動に備える)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    setTimeout(() => setScanState('preview'), 1000);
  }, [cameraReady]);

  // ── 4. OCR 解析 ──────────────────────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    if (!capturePayload) return;
    setScanState('analyzing');

    // セッション確認 — UNLOCKED でなければスキャン不可
    if (!session.isUnlocked()) {
      const errMsg = '生体認証が必要です。ホーム画面で認証してから再試行してください。';
      if (scanPhase === 'front') setFrontResult({ error: errMsg });
      else setBackNotes(`(エラー) ${errMsg}`);
      setScanState('result');
      return;
    }

    const dataKey = session.getMasterKey();
    if (!dataKey) {
      const errMsg = 'データキーを取得できませんでした。再度生体認証を行ってください。';
      if (scanPhase === 'front') setFrontResult({ error: errMsg });
      else setBackNotes(`(エラー) ${errMsg}`);
      setScanState('result');
      return;
    }

    // Azure 認証情報を復号（暗号化済みを優先、なければプレーンテキストにフォールバック）
    let endpoint = '';
    let apiKey   = '';
    const encryptedCreds = localStorage.getItem('azure_credentials_encrypted');
    if (encryptedCreds) {
      try {
        const creds = await decryptData<{ endpoint: string; apiKey: string }>(encryptedCreds, dataKey);
        endpoint = creds.endpoint.trim();
        apiKey   = creds.apiKey.trim();
      } catch {
        // 復号失敗 → プレーンテキストにフォールバック
        endpoint = localStorage.getItem(LS_AZURE.endpoint)?.trim() ?? '';
        apiKey   = localStorage.getItem(LS_AZURE.key)?.trim()      ?? '';
      }
    } else {
      endpoint = localStorage.getItem(LS_AZURE.endpoint)?.trim() ?? '';
      apiKey   = localStorage.getItem(LS_AZURE.key)?.trim()      ?? '';
    }

    if (!endpoint || !apiKey) {
      const errMsg = 'Azure OCR の設定が未完了です。\n\n設定画面でエンドポイントと API Key を入力してください。';
      if (scanPhase === 'front') setFrontResult({ error: errMsg });
      else setBackNotes(`(エラー) ${errMsg}`);
      setScanState('result');
      return;
    }

    try {
      const res = await fetch('/api/azure/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: capturePayload.imageBase64,
          cropRegion:  capturePayload.cropRegion,
          mode:        scanPhase,
          endpoint,
          apiKey,
          // 注: サーバー（Vercel）はこのキーをログせず Azure に転送するのみ
        }),
      });

      const data = await res.json() as {
        ok: boolean;
        result?: OcrResult;
        notes?: string;
        error?: string;
      };

      if (scanPhase === 'front') {
        setFrontResult(data.ok && data.result ? data.result : { error: data.error ?? '解析に失敗しました' });
      } else {
        setBackNotes(data.ok && data.notes != null ? data.notes : `(エラー) ${data.error ?? '裏面の読み取りに失敗しました'}`);
      }
    } catch (e) {
      const msg = `通信エラー: ${String(e)}`;
      if (scanPhase === 'front') setFrontResult({ error: msg });
      else setBackNotes(`(エラー) ${msg}`);
    }

    setScanState('result');
  }, [capturePayload, scanPhase]);

  // ── 5. State transitions ──────────────────────────────────────────────────

  /** カメラに戻る (フロント全リセット) */
  const resetFull = useCallback(() => {
    setCapturePayload(null);
    setThumbnail(null);
    setFrontResult(null);
    setBackNotes(null);
    setScanPhase('front');
    // ストリームを停止してから再起動 (真っ暗防止)
    restartCamera();
  }, [restartCamera]);

  /** 裏面スキャン開始 (フロント結果は保持) */
  const startBackScan = useCallback(() => {
    setCapturePayload(null);
    setThumbnail(null);
    setScanPhase('back');
    // 前のストリームを完全停止してから新セッションを開始 (真っ暗防止)
    restartCamera();
  }, [restartCamera]);

  /** 同じ面を再スキャン */
  const retake = useCallback(() => {
    setCapturePayload(null);
    setThumbnail(null);
    if (scanPhase === 'back') setBackNotes(null);
    // ストリームを停止してから再起動 (真っ暗防止)
    restartCamera();
  }, [scanPhase, restartCamera]);

  // ─── Derived values ────────────────────────────────────────────────────────
  const phaseLabel = scanPhase === 'front' ? '表面' : '裏面';
  const phaseColor = scanPhase === 'front' ? '#93c5fd' : '#86efac';
  const isCamera   = scanState === 'initializing' || scanState === 'ready' || scanState === 'scanning';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'row',
        width: '100vw', height: '100svh',
        background: '#0a0f1a', overflow: 'hidden',
      }}
    >

      {/* ══════════════════════════════════════════════════════════
          メインエリア — カメラ / プレビュー / 解析 / 結果
      ══════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#060a14' }}>
        <AnimatePresence mode="wait">

          {/* ── カメラビュー ── */}
          {isCamera && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <video
                ref={videoRef}
                autoPlay playsInline muted
                onLoadedMetadata={handleVideoReady}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                  opacity: cameraReady ? 1 : 0, transition: 'opacity 0.4s ease',
                }}
              />

              {/* キャンセル（戻る）ボタン — 常時表示 */}
              {cameraReady && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.back()}
                  style={{
                    position: 'absolute', top: 16, left: 16, zIndex: 30,
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.20)',
                    borderRadius: 10, padding: '8px 14px',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13, fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </motion.button>
              )}

              {/* カメラ起動中 */}
              {!cameraReady && !errorMsg && (
                <motion.div
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(59,130,246,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera style={{ width: 26, height: 26, color: '#93c5fd' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>カメラを起動中...</p>
                </motion.div>
              )}

              {/* エラー */}
              {errorMsg && (
                <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 40px', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle style={{ width: 26, height: 26, color: '#fca5a5' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{errorMsg}</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* カメラ再初期化リトライ */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={restartCamera}
                      style={{ background: 'rgba(37,99,235,0.22)', border: '1px solid rgba(59,130,246,0.40)', borderRadius: 10, padding: '8px 22px', fontSize: 13, color: '#93c5fd', cursor: 'pointer' }}
                    >
                      カメラを再起動
                    </motion.button>
                    {/* ページリロード (完全リセット) */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.location.reload()}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 22px', fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}
                    >
                      ページを更新
                    </motion.button>
                  </div>
                </div>
              )}

              {/* ガイド枠オーバーレイ — 縦横自動追従 */}
              {cameraReady && <ResponsiveGuide guideRef={guideRef} isScanning={scanState === 'scanning'} isPortrait={isPortrait} />}
            </motion.div>
          )}

          {/* ── プレビュー ── */}
          {scanState === 'preview' && thumbnail && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            >
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(16,185,129,0.45)', boxShadow: '0 0 40px rgba(16,185,129,0.20), 0 20px 60px rgba(0,0,0,0.6)', maxHeight: '90%', maxWidth: '100%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail} alt="キャプチャした名刺" style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 360, damping: 20 }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(16,185,129,0.92)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Check style={{ width: 15, height: 15, color: '#fff' }} strokeWidth={3} />
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── 解析中 ── */}
          {scanState === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}
            >
              {/* ゴールドのリング — 「脈打つ」存在感 */}
              <div className="lux-ring" style={{ width: 52, height: 52 }} />

              {/* テキスト */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(212,175,55,0.90)', letterSpacing: '0.06em' }}>
                  {scanPhase === 'front' ? 'OCR 解析中' : 'テキスト抽出中'}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 6, letterSpacing: '0.04em' }}>
                  Azure AI が{scanPhase === 'front' ? '名刺フィールドを認識' : '全文テキストを抽出'}しています
                </p>
              </div>

              {/* 光の糸 — 静かに走る水平ライン */}
              <div className="lux-thread-wrap" style={{ width: 120 }} />
            </motion.div>
          )}

          {/* ── 解析結果 ── */}
          {scanState === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '16px 14px 24px' }}
            >
              <ResultContent
                frontResult={frontResult}
                backNotes={backNotes}
                thumbnail={thumbnail}
                scanPhase={scanPhase}
                onSave={() => {
                  // OCR 結果を localStorage に一時保存し編集画面へ遷移
                  // 暗号化は edit/page.tsx で Data Key を使って行う
                  const tempData = {
                    name:    frontResult?.name    ?? null,
                    company: frontResult?.company ?? null,
                    title:   frontResult?.title   ?? null,
                    email:   frontResult?.email   ?? null,
                    tel:     frontResult?.tel     ?? null,
                    address: frontResult?.address ?? null,
                    raw:     frontResult?.raw     ?? null,
                    notes:   backNotes ?? null,
                  };
                  localStorage.setItem('edit_capture_temp', JSON.stringify(tempData));
                  router.push('/edit');
                }}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════
          サイドバー — ヘッダー + コンテキスト操作
      ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          width: 112, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(7,11,20,0.94)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* ヘッダー */}
        <div style={{ padding: '14px 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ marginBottom: 10 }}>
            <BackButton onClick={() => router.push('/')} />
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.1px' }}>
            名刺スキャン
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: phaseColor }} />
            <span style={{ fontSize: 10, color: phaseColor }}>{phaseLabel}</span>
          </div>
        </div>

        {/* ステータス + 操作エリア */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', gap: 12 }}>

          <AnimatePresence mode="wait">

            {/* ready — シャッター */}
            {scanState === 'ready' && cameraReady && !errorMsg && (
              <motion.div key="shutter-area"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
              >
                {isSessionUnlocked ? (
                  <>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.5 }}>
                      枠内に名刺を<br />合わせてください
                    </p>
                    <ShutterButton onClick={capture} phase={scanPhase} />
                  </>
                ) : (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock style={{ width: 20, height: 20, color: '#f87171' }} />
                    </div>
                    <p style={{ fontSize: 9, color: '#f87171', textAlign: 'center', lineHeight: 1.5 }}>
                      生体認証が<br />必要です
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* scanning */}
            {scanState === 'scanning' && (
              <motion.div key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <ProgressDots />
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', textAlign: 'center' }}>認識中...</p>
              </motion.div>
            )}

            {/* preview — 再撮影 / 解析開始 */}
            {scanState === 'preview' && (
              <motion.div key="preview-actions"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
              >
                <SidebarButton
                  icon={RotateCcw}
                  label="再撮影"
                  onClick={retake}
                  variant="ghost"
                />
                <SidebarButton
                  icon={Zap}
                  label="解析開始"
                  onClick={startAnalysis}
                  variant="primary"
                />
              </motion.div>
            )}

            {/* analyzing */}
            {scanState === 'analyzing' && (
              <motion.div key="analyzing-sidebar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
              >
                <span className="lux-dots">
                  <span /><span /><span />
                </span>
                <p style={{ fontSize: 9, color: 'rgba(212,175,55,0.45)', textAlign: 'center', letterSpacing: '0.06em' }}>解析中</p>
              </motion.div>
            )}

            {/* result */}
            {scanState === 'result' && (
              <motion.div key="result-actions"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
              >
                {/* 表面完了 → 裏面ボタン表示 */}
                {scanPhase === 'front' && !frontResult?.error && (
                  <SidebarButton
                    icon={FlipHorizontal2}
                    label="裏面も撮影"
                    onClick={startBackScan}
                    variant="accent"
                  />
                )}

                {/* 完了・ホームへ */}
                <SidebarButton
                  icon={Check}
                  label="完了"
                  onClick={() => router.push('/')}
                  variant="primary"
                />

                {/* 再スキャン */}
                <SidebarButton
                  icon={RotateCcw}
                  label="最初から"
                  onClick={resetFull}
                  variant="ghost"
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ヒント */}
        {scanState === 'ready' && cameraReady && (
          <div style={{ padding: '0 8px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', lineHeight: 1.5 }}>
              光の反射を抑えて<br />名刺全体を枠に収めて
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ResultContent ────────────────────────────────────────────────────────────

function ResultContent({
  frontResult, backNotes, thumbnail, scanPhase, onSave,
}: {
  frontResult: OcrResult | null;
  backNotes:   string | null;
  thumbnail:   string | null;
  scanPhase:   ScanPhase;
  onSave:      () => void;
}) {
  // エラー表示
  const hasError = frontResult?.error || (scanPhase === 'back' && backNotes?.startsWith('(エラー)'));
  if (hasError) {
    const errMsg = frontResult?.error ?? backNotes ?? '不明なエラー';
    return (
      <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 14, padding: '18px 16px', display: 'flex', gap: 12 }}>
        <AlertCircle style={{ color: '#f87171', width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>解析エラー</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{errMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 成功バナー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.28)', borderRadius: 12, padding: '10px 14px' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 18 }}
          style={{ width: 22, height: 22, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check style={{ width: 13, height: 13, color: '#fff' }} strokeWidth={3} />
        </motion.div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6ee7b7' }}>
            {scanPhase === 'back' && backNotes ? '表面 + 裏面 解析完了' : 'OCR 解析完了'}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            {scanPhase === 'back' && backNotes
              ? '裏面テキストを notes カラムに統合済み'
              : 'Azure AI が名刺フィールドを抽出しました'}
          </p>
        </div>
      </div>

      {/* サムネイル + 主要フィールド */}
      {frontResult && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {thumbnail && (
            <div style={{ flexShrink: 0, width: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnail} alt="名刺" style={{ width: '100%', display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <ResultField icon={User}      label="氏名"   value={frontResult.name}    />
            <ResultField icon={Building2} label="会社名" value={frontResult.company} />
            <ResultField icon={Briefcase} label="役職"   value={frontResult.title}   />
          </div>
        </div>
      )}

      {/* 連絡先フィールド */}
      {frontResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <ResultField icon={Mail}   label="メール" value={frontResult.email}   copyable />
          <ResultField icon={Phone}  label="電話"   value={frontResult.tel}     copyable />
          <ResultField icon={MapPin} label="住所"   value={frontResult.address} />
        </div>
      )}

      {/* 裏面テキスト (notes) */}
      {backNotes && !backNotes.startsWith('(エラー)') && (
        <div style={{ background: 'rgba(134,239,172,0.07)', border: '1px solid rgba(134,239,172,0.22)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <FileText style={{ width: 13, height: 13, color: '#86efac' }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: '#86efac' }}>裏面テキスト (notes)</p>
            <span style={{ fontSize: 9, background: 'rgba(134,239,172,0.15)', border: '1px solid rgba(134,239,172,0.25)', borderRadius: 4, padding: '1px 5px', color: '#86efac', marginLeft: 'auto' }}>DB保存用</span>
          </div>
          <pre style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-wrap', lineHeight: 1.65, margin: 0, wordBreak: 'break-all' }}>
            {backNotes}
          </pre>
        </div>
      )}

      {/* 生テキスト (折りたたみ) */}
      {frontResult?.raw && (
        <details style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
          <summary style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', userSelect: 'none' }}>
            生テキスト (OCR raw)
          </summary>
          <pre style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.38)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
            {frontResult.raw}
          </pre>
        </details>
      )}

      {/* 確認画面へボタン (frontResult が成功している場合に表示) */}
      {!frontResult?.error && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(16,185,129,0.30)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onSave}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '13px 16px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(5,150,105,0.40))',
            border: '1px solid rgba(52,211,153,0.45)',
            borderRadius: 14,
            color: '#a7f3d0',
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(16,185,129,0.20)',
            transition: 'all 0.2s ease',
          }}
        >
          <Check style={{ width: 16, height: 16 }} strokeWidth={2.5} />
          確認画面へ進む
        </motion.button>
      )}
    </div>
  );
}

// ─── ResponsiveGuide ──────────────────────────────────────────────────────────
// 縦横両対応のガイドフレーム

function ResponsiveGuide({
  guideRef, isScanning, isPortrait,
}: {
  guideRef: React.RefObject<HTMLDivElement | null>;
  isScanning: boolean;
  isPortrait: boolean;
}) {
  // 縦: 幅基準でガイド枠を決める、横: 高さ基準
  const guideStyle: React.CSSProperties = {
    position: 'absolute',
    // 縦向き: 幅をビューポート幅に対して決定、横: 高さをビューポート高さに対して決定
    ...(isPortrait
      ? {
          width: `${GUIDE_HEIGHT_RATIO * 100}%`,
          aspectRatio: `${1 / CARD_RATIO}`, // 縦向きなので逆比率
        }
      : {
          height: `${GUIDE_HEIGHT_RATIO * 100}%`,
          aspectRatio: `${CARD_RATIO}`,
        }),
    // 中央配置
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 0 9999px rgba(2,6,23,0.68)',
    borderRadius: 10,
    zIndex: 10,
    pointerEvents: 'none',
  };

  return (
    <div ref={guideRef} style={guideStyle}>
      <CornerBrackets isScanning={isScanning} />
      <AnimatePresence>{isScanning && <ScanBeam />}</AnimatePresence>
    </div>
  );
}

// ─── CornerBrackets ───────────────────────────────────────────────────────────

function CornerBrackets({ isScanning }: { isScanning: boolean }) {
  const color = isScanning ? '#10b981' : '#3b82f6';
  const size  = 22;
  const t     = '2.5px';
  const corners = [
    { top: 0, left: 0,    borderWidth: `${t} 0 0 ${t}`,  borderRadius: '10px 0 0 0' },
    { top: 0, right: 0,   borderWidth: `${t} ${t} 0 0`,  borderRadius: '0 10px 0 0' },
    { bottom: 0, left: 0, borderWidth: `0 0 ${t} ${t}`,  borderRadius: '0 0 0 10px' },
    { bottom: 0, right: 0,borderWidth: `0 ${t} ${t} 0`,  borderRadius: '0 0 10px 0' },
  ];
  return (
    <>
      {corners.map((style, i) => (
        <motion.div key={i}
          animate={{ borderColor: color }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'absolute',
            width: size, height: size,
            borderStyle: 'solid', borderColor: color,
            ...style,
          }}
        />
      ))}
    </>
  );
}

// ─── ScanBeam ─────────────────────────────────────────────────────────────────

function ScanBeam() {
  return (
    <motion.div
      initial={{ top: '2%' }}
      animate={{ top: ['2%', '95%', '2%'] }}
      transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
      style={{
        position: 'absolute', left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0) 5%, rgba(16,185,129,0.9) 50%, rgba(16,185,129,0) 95%, transparent 100%)',
        boxShadow: '0 0 14px 5px rgba(16,185,129,0.42)',
        borderRadius: 2, zIndex: 20,
      }}
    />
  );
}

// ─── ShutterButton ────────────────────────────────────────────────────────────

function ShutterButton({ onClick, phase }: { onClick: () => void; phase: ScanPhase }) {
  const isFront = phase === 'front';
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.90 }}
      onClick={onClick}
      style={{
        width: 72, height: 72, borderRadius: '50%',
        background: isFront ? 'rgba(37,99,235,0.18)' : 'rgba(16,185,129,0.18)',
        border: `2px solid ${isFront ? 'rgba(59,130,246,0.60)' : 'rgba(52,211,153,0.60)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: isFront
          ? '0 0 0 6px rgba(37,99,235,0.10), 0 4px 24px rgba(37,99,235,0.30)'
          : '0 0 0 6px rgba(16,185,129,0.10), 0 4px 24px rgba(16,185,129,0.30)',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: isFront
          ? 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(220,230,255,0.88))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(200,255,220,0.88))',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)',
      }} />
    </motion.button>
  );
}

// ─── SidebarButton ────────────────────────────────────────────────────────────

function SidebarButton({
  icon: Icon, label, onClick, variant,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'accent' | 'ghost';
}) {
  const styles = {
    primary: {
      bg:     'linear-gradient(135deg, rgba(37,99,235,0.50), rgba(29,78,216,0.35))',
      border: 'rgba(96,165,250,0.45)',
      color:  '#bfdbfe',
    },
    accent: {
      bg:     'linear-gradient(135deg, rgba(16,185,129,0.45), rgba(5,150,105,0.32))',
      border: 'rgba(52,211,153,0.45)',
      color:  '#a7f3d0',
    },
    ghost: {
      bg:     'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.12)',
      color:  'rgba(255,255,255,0.65)',
    },
  }[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '10px 6px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 12, color: styles.color,
        fontSize: 10, fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      <Icon style={{ width: 16, height: 16 }} strokeWidth={2} />
      {label}
    </motion.button>
  );
}

// ─── ResultField ──────────────────────────────────────────────────────────────

function ResultField({
  icon: Icon, label, value, copyable,
}: {
  icon: React.ElementType; label: string; value?: string; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  if (!value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '9px 11px' }}
    >
      <Icon style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.84)', wordBreak: 'break-all', lineHeight: 1.4 }}>{value}</p>
      </div>
      {copyable && (
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleCopy}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied ? '#10b981' : 'rgba(255,255,255,0.22)' }}
        >
          {copied
            ? <Check style={{ width: 12, height: 12 }} strokeWidth={3} />
            : <ChevronRight style={{ width: 12, height: 12 }} strokeWidth={2} />
          }
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── ProgressDots ─────────────────────────────────────────────────────────────

function ProgressDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}
        />
      ))}
    </div>
  );
}
