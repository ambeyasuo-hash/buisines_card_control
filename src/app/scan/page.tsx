'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, RotateCcw, Check, Zap,
  User, Building2, Phone, Mail, MapPin, Briefcase, AlertCircle, ScanLine,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';

// ─── Types ────────────────────────────────────────────────────────────────────
// 404を物理的に排除: 全フェーズを同一ページ内で管理
type ScanState = 'initializing' | 'ready' | 'scanning' | 'preview' | 'analyzing' | 'result';

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
const CARD_RATIO       = 91 / 55;    // 名刺縦横比 91mm × 55mm ≈ 1.655
const GUIDE_WIDTH_RATIO = 0.88;
const THUMBNAIL_WIDTH  = 150;
const HIRES_WIDTH      = 1200;
const HIRES_HEIGHT     = 800;

const LS_AZURE = {
  endpoint: 'azure_ocr_endpoint',
  key:      'azure_ocr_key',
  region:   'azure_ocr_region',
} as const;

// ─── Azure OCR helper ─────────────────────────────────────────────────────────
async function runAzureOcr(hiresBase64: string): Promise<OcrResult> {
  const endpoint = localStorage.getItem(LS_AZURE.endpoint)?.trim() ?? '';
  const apiKey   = localStorage.getItem(LS_AZURE.key)?.trim()      ?? '';

  if (!endpoint || !apiKey) {
    return { error: 'Azure OCR の設定が未入力です。設定画面から入力してください。' };
  }

  // Base64 → Blob
  const byteStr   = atob(hiresBase64.split(',')[1]);
  const arr       = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
  const blob = new Blob([arr], { type: 'image/jpeg' });

  // Submit to Read API
  const submitUrl = `${endpoint}/vision/v3.2/read/analyze?language=ja`;
  const submitRes = await fetch(submitUrl, {
    method:  'POST',
    headers: { 'Ocp-Apim-Subscription-Key': apiKey, 'Content-Type': 'image/jpeg' },
    body:    blob,
  });

  if (!submitRes.ok) {
    const msg = await submitRes.text();
    return { error: `Azure API エラー (${submitRes.status}): ${msg}` };
  }

  // Poll result
  const operationUrl = submitRes.headers.get('Operation-Location') ?? '';
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes  = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
    const pollData = await pollRes.json();

    if (pollData.status === 'succeeded') {
      const lines: string[] = [];
      for (const page of pollData.analyzeResult?.readResults ?? []) {
        for (const line of page.lines ?? []) lines.push(line.text);
      }
      return parseBusinessCard(lines);
    }
    if (pollData.status === 'failed') return { error: 'OCR 解析に失敗しました。' };
  }

  return { error: 'OCR がタイムアウトしました。再試行してください。' };
}

// ─── Simple business card parser ──────────────────────────────────────────────
function parseBusinessCard(lines: string[]): OcrResult {
  const raw   = lines.join('\n');
  const result: OcrResult = { raw };

  const emailRe = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
  const telRe   = /(?:tel|電話|mobile|携帯)?[\s:：]*([\d\-+()（）\s]{10,})/i;

  for (const line of lines) {
    if (!result.email  && emailRe.test(line))    result.email = line.match(emailRe)![0];
    if (!result.tel    && telRe.test(line))       result.tel   = line.match(telRe)![1].trim();
    if (!result.address && /\d[-\d]+|[都道府県市区町村]/.test(line)) result.address = line;

    // Corporate suffix → company
    if (!result.company && /株式会社|有限会社|合同会社|Corporation|Corp\.|Inc\.|Ltd\./.test(line))
      result.company = line;

    // Title heuristic
    if (!result.title && /(部長|課長|部|室|事業部|Director|Manager|CEO|CTO|Engineer|部門)/.test(line))
      result.title = line;
  }

  // Name: first line that's ≥2 Japanese chars with no digits/emails
  const nameLine = lines.find(
    (l) => /^[\u3000-\u9fff\s　]{2,}$/.test(l.replace(/\s/g, '')) &&
            !emailRe.test(l) && !telRe.test(l),
  );
  if (nameLine) result.name = nameLine.trim();

  return result;
}

// ─── ScanPage ─────────────────────────────────────────────────────────────────
export default function ScanPage() {
  const router      = useRouter();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const guideRef    = useRef<HTMLDivElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [scanState,   setScanState]   = useState<ScanState>('initializing');
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [thumbnail,   setThumbnail]   = useState<string | null>(null);
  const [hiresData,   setHiresData]   = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [ocrResult,   setOcrResult]   = useState<OcrResult | null>(null);

  // ── Start camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setErrorMsg('カメラのアクセスが拒否されました。\nブラウザの設定からカメラ許可を有効にしてください。');
        } else if (e.name === 'NotFoundError') {
          setErrorMsg('カメラが見つかりません。\nデバイスにカメラが接続されているか確認してください。');
        } else {
          setErrorMsg(`カメラの起動に失敗しました: ${e.message}`);
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

  // ── Capture & crop ────────────────────────────────────────────────────────
  const capture = useCallback(() => {
    const video  = videoRef.current;
    const guide  = guideRef.current;
    const canvas = canvasRef.current;
    if (!video || !guide || !canvas) return;

    setScanState('scanning');

    const guideRect = guide.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    const scaleX    = video.videoWidth  / videoRect.width;
    const scaleY    = video.videoHeight / videoRect.height;
    const srcX = (guideRect.left - videoRect.left) * scaleX;
    const srcY = (guideRect.top  - videoRect.top)  * scaleY;
    const srcW = guideRect.width  * scaleX;
    const srcH = guideRect.height * scaleY;

    // Hi-res (OCR用 1200×800px)
    const hiresCanvas = document.createElement('canvas');
    hiresCanvas.width  = HIRES_WIDTH;
    hiresCanvas.height = HIRES_HEIGHT;
    hiresCanvas.getContext('2d')!.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, HIRES_WIDTH, HIRES_HEIGHT);
    const hiresBase64 = hiresCanvas.toDataURL('image/jpeg', 0.92);

    // Thumbnail (150px)
    const thumbScale   = THUMBNAIL_WIDTH / srcW;
    canvas.width  = THUMBNAIL_WIDTH;
    canvas.height = Math.round(srcH * thumbScale);
    canvas.getContext('2d')!.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    const thumbBase64 = canvas.toDataURL('image/jpeg', 0.72);

    setHiresData(hiresBase64);
    setThumbnail(thumbBase64);

    setTimeout(() => setScanState('preview'), 1600);
  }, []);

  // ── Reset to camera ───────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setThumbnail(null);
    setHiresData(null);
    setOcrResult(null);
    setScanState('ready');
  }, []);

  // ── Start OCR analysis ────────────────────────────────────────────────────
  // ページ遷移なし・PII をメモリ内で完結させる
  const startAnalysis = useCallback(async () => {
    if (!hiresData) return;
    setScanState('analyzing');
    setOcrResult(null);

    try {
      const result = await runAzureOcr(hiresData);
      setOcrResult(result);
    } catch (e) {
      setOcrResult({ error: `解析中にエラーが発生しました: ${String(e)}` });
    }
    setScanState('result');
  }, [hiresData]);

  // ─── Dynamic header subtitle ──────────────────────────────────────────────
  const subtitle = {
    initializing: 'カメラを起動中...',
    ready:        cameraReady ? '枠内に名刺を合わせてシャッターを押してください' : '',
    scanning:     'キャプチャ中...',
    preview:      'キャプチャ完了 — 確認してください',
    analyzing:    'OCR 解析中 — しばらくお待ちください',
    result:       ocrResult?.error ? '解析に問題が発生しました' : '解析完了',
  }[scanState];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[100svh] flex flex-col" style={{ background: '#0a0f1a' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3 z-20 flex-none"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <BackButton onClick={() => router.push('/')} />
        <div>
          <h2 className="text-white font-semibold text-[15px] leading-tight">名刺スキャン</h2>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.32)' }}>{subtitle}</p>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <AnimatePresence mode="wait">

          {/* ── CAMERA VIEW (initializing / ready / scanning) ── */}
          {(scanState === 'initializing' || scanState === 'ready' || scanState === 'scanning') && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <video
                ref={videoRef}
                autoPlay playsInline muted
                onLoadedMetadata={handleVideoReady}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: cameraReady ? 1 : 0, transition: 'opacity 0.4s ease' }}
              />

              {/* Loading */}
              {!cameraReady && !errorMsg && (
                <motion.div
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="z-10 flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(59,130,246,0.40)' }}>
                    <Camera className="w-6 h-6" style={{ color: '#93c5fd' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>カメラを起動中...</p>
                </motion.div>
              )}

              {/* Error */}
              {errorMsg && (
                <div className="z-10 flex flex-col items-center gap-4 px-8 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}>
                    <Camera className="w-7 h-7" style={{ color: '#fca5a5' }} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-line' }}>
                    {errorMsg}
                  </p>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => window.location.reload()}
                    style={{ background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(59,130,246,0.40)', borderRadius: '10px', padding: '8px 20px', fontSize: '13px', color: '#93c5fd', cursor: 'pointer' }}>
                    再試行
                  </motion.button>
                </div>
              )}

              {/* Guide overlay */}
              {cameraReady && <GuideOverlay guideRef={guideRef} isScanning={scanState === 'scanning'} />}
            </motion.div>
          )}

          {/* ── PREVIEW VIEW ── */}
          {scanState === 'preview' && thumbnail && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
            >
              <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.40)', boxShadow: '0 0 40px rgba(16,185,129,0.18), 0 20px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', width: '100%', maxWidth: '480px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail} alt="スキャンした名刺" style={{ width: '100%', display: 'block' }} />
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 360, damping: 20 }}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(16,185,129,0.90)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                </motion.div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>キャプチャ成功</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>高画質データ (OCR用) + サムネイルを生成しました</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px' }}>
                <DataBadge label="サムネイル" value={formatBytes(thumbnail.length * 0.75)} color="emerald" />
                <DataBadge label="高画質 (OCR)" value={formatBytes((hiresData?.length ?? 0) * 0.75)} color="blue" />
              </div>
            </motion.div>
          )}

          {/* ── ANALYZING VIEW ── */}
          {scanState === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6 px-8"
            >
              {/* Pulsing OCR icon */}
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'rgba(16,185,129,0.20)', border: '1px solid rgba(52,211,153,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ScanLine className="w-9 h-9" style={{ color: '#6ee7b7' }} strokeWidth={1.5} />
              </motion.div>

              <div className="text-center space-y-2">
                <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>OCR 解析中</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Azure AI Vision で名刺のテキストを読み取っています
                </p>
              </div>

              {/* Progress dots */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <motion.div key={i}
                    animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.6, 1.4, 0.6] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                    style={{ width: '4px', height: '20px', borderRadius: '2px', background: '#10b981' }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── RESULT VIEW ── */}
          {scanState === 'result' && ocrResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className="absolute inset-0 overflow-y-auto px-5 py-6 flex flex-col gap-4"
            >
              {ocrResult.error ? (
                /* ── Error card ── */
                <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '16px', padding: '20px', display: 'flex', gap: '12px' }}>
                  <AlertCircle style={{ color: '#f87171', width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5', marginBottom: '4px' }}>解析エラー</p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', lineHeight: '1.6' }}>{ocrResult.error}</p>
                  </div>
                </div>
              ) : (
                /* ── Result card ── */
                <>
                  {/* Success banner */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.28)', borderRadius: '12px', padding: '12px 14px' }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </motion.div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#6ee7b7' }}>OCR 解析完了</p>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>テキストを抽出しました</p>
                    </div>
                  </div>

                  {/* Thumbnail + fields row */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {thumbnail && (
                      <div style={{ flexShrink: 0, width: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbnail} alt="名刺" style={{ width: '100%', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <ResultField icon={User}      label="氏名"    value={ocrResult.name}    />
                      <ResultField icon={Building2} label="会社名"  value={ocrResult.company} />
                      <ResultField icon={Briefcase} label="役職"    value={ocrResult.title}   />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <ResultField icon={Mail}    label="メール"  value={ocrResult.email}   copyable />
                    <ResultField icon={Phone}   label="電話"    value={ocrResult.tel}     copyable />
                    <ResultField icon={MapPin}  label="住所"    value={ocrResult.address} />
                  </div>

                  {/* Raw OCR text (collapsed by default) */}
                  {ocrResult.raw && (
                    <details style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 12px' }}>
                      <summary style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', userSelect: 'none' }}>
                        生テキスト (OCR raw)
                      </summary>
                      <pre style={{ marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.40)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        {ocrResult.raw}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="z-20 flex-none px-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <AnimatePresence mode="wait">

          {/* Ready: shutter */}
          {scanState === 'ready' && cameraReady && (
            <motion.div key="shutter" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex justify-center">
              <ShutterButton onClick={capture} />
            </motion.div>
          )}

          {/* Scanning: progress */}
          {scanState === 'scanning' && (
            <motion.div key="scanning-msg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col items-center gap-3">
              <ScanProgressDots />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>名刺を認識中...</p>
            </motion.div>
          )}

          {/* Preview: re-scan + analyze */}
          {scanState === 'preview' && (
            <motion.div key="preview-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 500 }}
              >
                <RotateCcw className="w-4 h-4" />
                再スキャン
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 8px 32px rgba(16,185,129,0.35)' }}
                whileTap={{ scale: 0.96 }}
                onClick={startAnalysis}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(5,150,105,0.40))', border: '1px solid rgba(52,211,153,0.45)', color: '#a7f3d0', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(16,185,129,0.20)' }}
              >
                <Zap className="w-4 h-4" />
                解析を開始
              </motion.button>
            </motion.div>
          )}

          {/* Result: re-scan */}
          {scanState === 'result' && (
            <motion.div key="result-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 500 }}
              >
                <RotateCcw className="w-4 h-4" />
                別の名刺をスキャン
              </motion.button>

              {!ocrResult?.error && (
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 8px 32px rgba(37,99,235,0.35)' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => router.push('/')}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.55), rgba(29,78,216,0.40))', border: '1px solid rgba(96,165,250,0.45)', color: '#bfdbfe', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(37,99,235,0.20)' }}
                >
                  <Check className="w-4 h-4" />
                  完了・ホームへ
                </motion.button>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
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
      style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '9px 11px' }}
    >
      <Icon style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.82)', wordBreak: 'break-all', lineHeight: '1.4' }}>{value}</p>
      </div>
      {copyable && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleCopy}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: copied ? '#10b981' : 'rgba(255,255,255,0.25)' }}
        >
          {copied ? <Check style={{ width: '13px', height: '13px' }} strokeWidth={3} /> : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── GuideOverlay ─────────────────────────────────────────────────────────────
function GuideOverlay({ guideRef, isScanning }: { guideRef: React.RefObject<HTMLDivElement | null>; isScanning: boolean }) {
  return (
    <div
      ref={guideRef}
      style={{ position: 'absolute', width: `${GUIDE_WIDTH_RATIO * 100}%`, maxWidth: '520px', aspectRatio: `${CARD_RATIO}`, boxShadow: '0 0 0 9999px rgba(2,6,23,0.72)', borderRadius: '10px', zIndex: 10, pointerEvents: 'none' }}
    >
      <CornerBrackets isScanning={isScanning} />
      <AnimatePresence>{isScanning && <ScanBeam />}</AnimatePresence>
    </div>
  );
}

// ─── CornerBrackets ───────────────────────────────────────────────────────────
function CornerBrackets({ isScanning }: { isScanning: boolean }) {
  const color = isScanning ? '#10b981' : '#3b82f6';
  const size  = 22;
  const t     = 2.5;
  const corners = [
    { top: 0, left: 0, borderWidth: `${t}px 0 0 ${t}px`, borderRadius: '10px 0 0 0' },
    { top: 0, right: 0, borderWidth: `${t}px ${t}px 0 0`, borderRadius: '0 10px 0 0' },
    { bottom: 0, left: 0, borderWidth: `0 0 ${t}px ${t}px`, borderRadius: '0 0 0 10px' },
    { bottom: 0, right: 0, borderWidth: `0 ${t}px ${t}px 0`, borderRadius: '0 0 10px 0' },
  ];
  return (
    <>
      {corners.map((style, i) => (
        <motion.div key={i} animate={{ borderColor: color }} transition={{ duration: 0.4 }}
          style={{ position: 'absolute', width: `${size}px`, height: `${size}px`, borderStyle: 'solid', borderColor: color, ...style }} />
      ))}
    </>
  );
}

// ─── ScanBeam ─────────────────────────────────────────────────────────────────
function ScanBeam() {
  return (
    <motion.div
      initial={{ top: '0%' }}
      animate={{ top: ['2%', '95%', '2%'] }}
      transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
      style={{ position: 'absolute', left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.0) 5%, rgba(16,185,129,0.9) 50%, rgba(16,185,129,0.0) 95%, transparent 100%)', boxShadow: '0 0 12px 4px rgba(16,185,129,0.45)', borderRadius: '2px', zIndex: 20 }}
    />
  );
}

// ─── ShutterButton ────────────────────────────────────────────────────────────
function ShutterButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
      onClick={onClick}
      style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(37,99,235,0.18)', border: '2px solid rgba(59,130,246,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 0 6px rgba(37,99,235,0.10), 0 4px 24px rgba(37,99,235,0.30)', position: 'relative' }}
    >
      <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(220,230,255,0.90))', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)' }} />
    </motion.button>
  );
}

// ─── ScanProgressDots ─────────────────────────────────────────────────────────
function ScanProgressDots() {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
          style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}
        />
      ))}
    </div>
  );
}

// ─── DataBadge ────────────────────────────────────────────────────────────────
function DataBadge({ label, value, color }: { label: string; value: string; color: 'emerald' | 'blue' }) {
  const cfg = {
    emerald: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(52,211,153,0.28)', text: '#6ee7b7', dot: '#10b981' },
    blue:    { bg: 'rgba(37,99,235,0.12)',  border: 'rgba(59,130,246,0.28)', text: '#93c5fd', dot: '#3b82f6' },
  }[color];
  return (
    <div style={{ flex: 1, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.dot }} />
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.40)' }}>{label}</span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: cfg.text }}>{value}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
