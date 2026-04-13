'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Camera, RotateCcw, Check, Zap } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type ScanState = 'initializing' | 'ready' | 'scanning' | 'preview';

// ─── Constants ────────────────────────────────────────────────────────────────
// Business card aspect ratio: 91mm × 55mm
const CARD_RATIO = 91 / 55; // ≈ 1.655
const GUIDE_WIDTH_RATIO = 0.88; // 88% of container width
const THUMBNAIL_WIDTH = 480;
const HIRES_WIDTH = 1200;

// ─── ScanPage ─────────────────────────────────────────────────────────────────
export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanState, setScanState] = useState<ScanState>('initializing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);   // lightweight Base64
  const [hiresData, setHiresData] = useState<string | null>(null);    // OCR-quality Base64
  const [cameraReady, setCameraReady] = useState(false);

  // ── Start camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // 背面カメラ優先
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
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
        setScanState('ready'); // show error state
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
    const video = videoRef.current;
    const guide = guideRef.current;
    const canvas = canvasRef.current;
    if (!video || !guide || !canvas) return;

    setScanState('scanning');

    // Guide rect in viewport coords
    const guideRect = guide.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();

    // Ratio of displayed video vs actual video resolution
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    // Guide rect in actual video pixel coords
    const srcX = (guideRect.left - videoRect.left) * scaleX;
    const srcY = (guideRect.top - videoRect.top) * scaleY;
    const srcW = guideRect.width * scaleX;
    const srcH = guideRect.height * scaleY;

    // ── Hi-res capture (OCR用) ──
    const hiresCanvas = document.createElement('canvas');
    const hiresScale = HIRES_WIDTH / srcW;
    hiresCanvas.width = HIRES_WIDTH;
    hiresCanvas.height = Math.round(srcH * hiresScale);
    const hiresCtx = hiresCanvas.getContext('2d')!;
    hiresCtx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, hiresCanvas.width, hiresCanvas.height);
    const hiresBase64 = hiresCanvas.toDataURL('image/jpeg', 0.92);

    // ── Thumbnail capture (一覧表示用) ──
    const thumbScale = THUMBNAIL_WIDTH / srcW;
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = Math.round(srcH * thumbScale);
    const thumbCtx = canvas.getContext('2d')!;
    thumbCtx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    const thumbBase64 = canvas.toDataURL('image/jpeg', 0.72);

    setHiresData(hiresBase64);
    setThumbnail(thumbBase64);

    // アニメーション後にプレビューへ
    setTimeout(() => {
      setScanState('preview');
    }, 2000);
  }, []);

  const reset = useCallback(() => {
    setThumbnail(null);
    setHiresData(null);
    setScanState('ready');
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full min-h-screen flex flex-col" style={{ background: '#020617' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-4 pt-4 pb-3 z-20 relative"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <motion.button
          whileHover={{ x: -3, backgroundColor: 'rgba(255,255,255,0.07)' }}
          whileTap={{ scale: 0.92 }}
          onClick={() => router.push('/')}
          className="p-2 rounded-xl cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h2 className="text-white font-semibold text-[15px] leading-tight">名刺スキャン</h2>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
            {scanState === 'ready' && cameraReady && '枠内に名刺を合わせてシャッターを押してください'}
            {scanState === 'scanning' && 'セキュリティ・コンテキストを構築中...'}
            {scanState === 'preview' && 'キャプチャ完了 — 確認してください'}
            {scanState === 'initializing' && 'カメラを起動中...'}
          </p>
        </div>
      </div>

      {/* ── Camera / Preview Area ── */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">

        {/* ──── CAMERA VIEW ──── */}
        <AnimatePresence>
          {scanState !== 'preview' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* Video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={handleVideoReady}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: cameraReady ? 1 : 0, transition: 'opacity 0.4s ease' }}
              />

              {/* Loading state */}
              {!cameraReady && !errorMsg && (
                <motion.div
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="z-10 flex flex-col items-center gap-3"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'rgba(37,99,235,0.25)',
                      border: '1px solid rgba(59,130,246,0.40)',
                    }}
                  >
                    <Camera className="w-6 h-6" style={{ color: '#93c5fd' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    カメラを起動中...
                  </p>
                </motion.div>
              )}

              {/* Error state */}
              {errorMsg && (
                <div className="z-10 flex flex-col items-center gap-4 px-8 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.35)',
                    }}
                  >
                    <Camera className="w-7 h-7" style={{ color: '#fca5a5' }} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-line' }}>
                    {errorMsg}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.reload()}
                    style={{
                      background: 'rgba(37,99,235,0.25)',
                      border: '1px solid rgba(59,130,246,0.40)',
                      borderRadius: '10px',
                      padding: '8px 20px',
                      fontSize: '13px',
                      color: '#93c5fd',
                      cursor: 'pointer',
                    }}
                  >
                    再試行
                  </motion.button>
                </div>
              )}

              {/* ── Overlay + Guide (only when camera is ready) ── */}
              {cameraReady && (
                <GuideOverlay
                  guideRef={guideRef}
                  isScanning={scanState === 'scanning'}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ──── PREVIEW VIEW ──── */}
        <AnimatePresence>
          {scanState === 'preview' && thumbnail && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
            >
              {/* Captured image */}
              <div
                style={{
                  position: 'relative',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid rgba(16,185,129,0.40)',
                  boxShadow: '0 0 40px rgba(16,185,129,0.18), 0 20px 60px rgba(0,0,0,0.5)',
                  width: '100%',
                  maxWidth: '480px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnail}
                  alt="スキャンした名刺"
                  style={{ width: '100%', display: 'block' }}
                />
                {/* Success badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 360, damping: 20 }}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(16,185,129,0.90)',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                </motion.div>
              </div>

              {/* Info */}
              <div className="text-center space-y-1">
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  キャプチャ成功
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  高画質データ (OCR用) + サムネイルを生成しました
                </p>
              </div>

              {/* Data size info */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  width: '100%',
                  maxWidth: '360px',
                }}
              >
                <DataBadge label="サムネイル" value={formatBytes(thumbnail.length * 0.75)} color="emerald" />
                <DataBadge label="高画質 (OCR)" value={formatBytes((hiresData?.length ?? 0) * 0.75)} color="blue" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Controls ── */}
      <div
        className="z-20 relative px-6 pb-8 pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <AnimatePresence mode="wait">

          {/* Ready state: Shutter button */}
          {scanState === 'ready' && cameraReady && (
            <motion.div
              key="shutter"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex justify-center"
            >
              <ShutterButton onClick={capture} />
            </motion.div>
          )}

          {/* Scanning state: progress message */}
          {scanState === 'scanning' && (
            <motion.div
              key="scanning-msg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-3"
            >
              <ScanProgressDots />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
                セキュリティ・コンテキストを構築中 — 画像解析中
              </p>
            </motion.div>
          )}

          {/* Preview state: action buttons */}
          {scanState === 'preview' && (
            <motion.div
              key="preview-actions"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <RotateCcw className="w-4 h-4" />
                再スキャン
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 8px 32px rgba(16,185,129,0.35)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  // 次フェーズ: OCR解析などへ渡す
                  alert('OCR解析フェーズへ進みます（Phase 2 で実装予定）');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(5,150,105,0.40))',
                  border: '1px solid rgba(52,211,153,0.45)',
                  color: '#a7f3d0',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 4px 20px rgba(16,185,129,0.20)',
                }}
              >
                <Zap className="w-4 h-4" />
                解析を開始
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ─── GuideOverlay ─────────────────────────────────────────────────────────────
function GuideOverlay({
  guideRef,
  isScanning,
}: {
  guideRef: React.RefObject<HTMLDivElement | null>;
  isScanning: boolean;
}) {
  return (
    <>
      {/* Full-screen dark overlay — the guide's box-shadow creates the "hole" effect */}
      <div
        ref={guideRef}
        style={{
          position: 'absolute',
          // Centered, 88% of width
          width: `${GUIDE_WIDTH_RATIO * 100}%`,
          maxWidth: '520px',
          aspectRatio: `${CARD_RATIO}`,
          // box-shadow punches through to reveal camera behind overlay
          boxShadow: '0 0 0 9999px rgba(2,6,23,0.72)',
          borderRadius: '10px',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {/* Animated corner brackets */}
        <CornerBrackets isScanning={isScanning} />

        {/* Scan beam (only during scanning) */}
        <AnimatePresence>
          {isScanning && <ScanBeam />}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── CornerBrackets ───────────────────────────────────────────────────────────
function CornerBrackets({ isScanning }: { isScanning: boolean }) {
  const color = isScanning ? '#10b981' : '#3b82f6';
  const size = 22;
  const thickness = 2.5;

  const corners = [
    { top: 0, left: 0, borderWidth: `${thickness}px 0 0 ${thickness}px`, borderRadius: '10px 0 0 0' },
    { top: 0, right: 0, borderWidth: `${thickness}px ${thickness}px 0 0`, borderRadius: '0 10px 0 0' },
    { bottom: 0, left: 0, borderWidth: `0 0 ${thickness}px ${thickness}px`, borderRadius: '0 0 0 10px' },
    { bottom: 0, right: 0, borderWidth: `0 ${thickness}px ${thickness}px 0`, borderRadius: '0 0 10px 0' },
  ];

  return (
    <>
      {corners.map((style, i) => (
        <motion.div
          key={i}
          animate={{ borderColor: color }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderStyle: 'solid',
            borderColor: color,
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
      initial={{ top: '0%' }}
      animate={{ top: ['2%', '95%', '2%'] }}
      transition={{
        duration: 1.8,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'loop',
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.0) 5%, rgba(16,185,129,0.9) 50%, rgba(16,185,129,0.0) 95%, transparent 100%)',
        boxShadow: '0 0 12px 4px rgba(16,185,129,0.45)',
        borderRadius: '2px',
        zIndex: 20,
      }}
    />
  );
}

// ─── ShutterButton ────────────────────────────────────────────────────────────
function ShutterButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'rgba(37,99,235,0.18)',
        border: '2px solid rgba(59,130,246,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 0 0 6px rgba(37,99,235,0.10), 0 4px 24px rgba(37,99,235,0.30)',
        position: 'relative',
      }}
    >
      {/* Inner white circle (classic shutter style) */}
      <div
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(220,230,255,0.90))',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)',
        }}
      />
    </motion.button>
  );
}

// ─── ScanProgressDots ─────────────────────────────────────────────────────────
function ScanProgressDots() {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.22,
            ease: 'easeInOut',
          }}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#10b981',
          }}
        />
      ))}
    </div>
  );
}

// ─── DataBadge ────────────────────────────────────────────────────────────────
function DataBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'emerald' | 'blue';
}) {
  const cfg = {
    emerald: {
      bg: 'rgba(16,185,129,0.10)',
      border: 'rgba(52,211,153,0.28)',
      text: '#6ee7b7',
      dot: '#10b981',
    },
    blue: {
      bg: 'rgba(37,99,235,0.12)',
      border: 'rgba(59,130,246,0.28)',
      text: '#93c5fd',
      dot: '#3b82f6',
    },
  }[color];

  return (
    <div
      style={{
        flex: 1,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '10px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: cfg.dot,
          }}
        />
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
