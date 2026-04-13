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
  AlertCircle, ScanLine, FileText, ChevronRight,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';

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

  // Core state
  const [scanState,   setScanState]   = useState<ScanState>('initializing');
  const [scanPhase,   setScanPhase]   = useState<ScanPhase>('front');
  const [isPortrait,  setIsPortrait]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Capture & result data
  const [thumbnail,      setThumbnail]      = useState<string | null>(null);
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(null);
  const [frontResult,    setFrontResult]    = useState<OcrResult | null>(null);
  const [backNotes,      setBackNotes]      = useState<string | null>(null);

  // ── 1. Orientation lock & monitoring ─────────────────────────────────────
  useEffect(() => {
    // iOS は lock 非サポートのため try/catch で安全に処理
    if (typeof screen !== 'undefined' && screen.orientation && 'lock' in screen.orientation) {
      (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> })
        .lock('landscape')
        .catch(() => { /* silently ignore — iOS/一部ブラウザ非対応 */ });
    }
    return () => {
      try {
        if (typeof screen !== 'undefined' && screen.orientation && 'unlock' in screen.orientation) {
          screen.orientation.unlock();
        }
      } catch { /* ignore */ }
    };
  }, []);

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
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        // 4K → FHD → HD の順にフォールバック
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 3840, min: 1280 },
            height: { ideal: 2160, min: 720 },
          },
          audio: false,
        });

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setErrorMsg('カメラの使用が許可されていません。\n\nブラウザ設定 → カメラ → このサイトに許可してください。');
        } else if (e.name === 'NotFoundError') {
          setErrorMsg('カメラが見つかりません。\n\nカメラ付きデバイスで開いてください。');
        } else if (e.name === 'NotReadableError') {
          setErrorMsg('カメラが他のアプリで使用中です。\n\nビデオ通話などを終了してから再試行してください。');
        } else {
          setErrorMsg('カメラの起動に失敗しました。\n\nブラウザを再起動してもう一度お試しください。');
        }
        setScanState('ready');
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleVideoReady = useCallback(() => {
    setCameraReady(true);
    setScanState('ready');
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

    setTimeout(() => setScanState('preview'), 1000);
  }, [cameraReady]);

  // ── 4. OCR 解析 ──────────────────────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    if (!capturePayload) return;
    setScanState('analyzing');

    const endpoint = localStorage.getItem(LS_AZURE.endpoint)?.trim() ?? '';
    const apiKey   = localStorage.getItem(LS_AZURE.key)?.trim()      ?? '';

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
    setScanState('ready');
  }, []);

  /** 裏面スキャン開始 (フロント結果は保持) */
  const startBackScan = useCallback(() => {
    setCapturePayload(null);
    setThumbnail(null);
    setScanPhase('back');
    setScanState('ready');
  }, []);

  /** 同じ面を再スキャン */
  const retake = useCallback(() => {
    setCapturePayload(null);
    setThumbnail(null);
    if (scanPhase === 'back') setBackNotes(null);
    setScanState('ready');
  }, [scanPhase]);

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
      {/* ── Portrait Warning Overlay ── */}
      <AnimatePresence>
        {isPortrait && (
          <motion.div
            key="portrait-warn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 200,
              background: 'rgba(8,12,22,0.96)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 20, padding: 32, textAlign: 'center',
            }}
          >
            <motion.div
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 72, height: 72, borderRadius: 22,
                background: 'rgba(59,130,246,0.20)',
                border: '1px solid rgba(96,165,250,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FlipHorizontal2 style={{ width: 32, height: 32, color: '#93c5fd' }} />
            </motion.div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: 8 }}>
                端末を横にしてください
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                名刺をより正確に読み取るため<br />
                横持ち (ランドスケープ) での撮影を推奨しています
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <Camera style={{ width: 26, height: 26, color: '#fca5a5' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{errorMsg}</p>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => window.location.reload()}
                    style={{ background: 'rgba(37,99,235,0.22)', border: '1px solid rgba(59,130,246,0.40)', borderRadius: 10, padding: '8px 22px', fontSize: 13, color: '#93c5fd', cursor: 'pointer' }}>
                    再試行
                  </motion.button>
                </div>
              )}

              {/* ガイド枠オーバーレイ */}
              {cameraReady && <LandscapeGuide guideRef={guideRef} isScanning={scanState === 'scanning'} />}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}
            >
              <motion.div
                animate={{ scale: [1, 1.09, 1], opacity: [0.65, 1, 0.65] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(52,211,153,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ScanLine style={{ width: 34, height: 34, color: '#6ee7b7' }} strokeWidth={1.5} />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                  {scanPhase === 'front' ? 'OCR 解析中' : '裏面テキスト抽出中'}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 6 }}>
                  Azure AI で {scanPhase === 'front' ? '名刺フィールドを認識' : '全文テキストを抽出'} しています...
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <motion.div key={i}
                    animate={{ opacity: [0.15, 1, 0.15], scaleY: [0.5, 1.5, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                    style={{ width: 4, height: 22, borderRadius: 2, background: '#10b981' }}
                  />
                ))}
              </div>
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
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.5 }}>
                  枠内に名刺を<br />合わせてください
                </p>
                <ShutterButton onClick={capture} phase={scanPhase} />
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
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                >
                  <ScanLine style={{ width: 24, height: 24, color: '#10b981' }} />
                </motion.div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', textAlign: 'center' }}>解析中...</p>
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
  frontResult, backNotes, thumbnail, scanPhase,
}: {
  frontResult: OcrResult | null;
  backNotes:   string | null;
  thumbnail:   string | null;
  scanPhase:   ScanPhase;
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
    </div>
  );
}

// ─── LandscapeGuide ───────────────────────────────────────────────────────────

function LandscapeGuide({
  guideRef, isScanning,
}: {
  guideRef: React.RefObject<HTMLDivElement | null>;
  isScanning: boolean;
}) {
  // 横持ち前提: 高さ基準でガイド枠を決める
  const guideStyle: React.CSSProperties = {
    position: 'absolute',
    // 高さをビューポートの GUIDE_HEIGHT_RATIO に、幅をカード比率で決定
    height: `${GUIDE_HEIGHT_RATIO * 100}%`,
    aspectRatio: `${CARD_RATIO}`,
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
