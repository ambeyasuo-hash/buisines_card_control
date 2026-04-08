// (c) 2026 ambe / Business_Card_Folder

# あんべの名刺代わり — Design Document v3.0
## On-Device Security Edition

---

## 1. 製品概要

**コンセプト:** 「配布可能な信頼」

外部APIを一切介さず、ブラウザ内で完結する超セキュアなAI名刺管理ツール。

**ターゲット:** プライバシー意識の高いコンサルタント・営業職

**技術的制約:**
- 完全無料（クラウドコストなし）
- 外部API通信ゼロ（解析工程）
- ブラウザのみで OCR 完結
- 画像データはメモリ内で処理・即廃棄

---

## 2. セキュリティ・ポリシー（最優先）

### Zero Cloud Extraction
**原則:** 名刺画像のOCR解析に外部AI（Gemini、Google Vision等）を使用することは**厳禁**。

**実装:**
- Tesseract.js によるオンデバイス認識
- WebWorker で UI スレッドを保護
- WASM（Tesseract + OpenCV）の完全ローカル実行

### Privacy by Design
**原則:** 画像データはブラウザのメモリ内でのみ処理し、解析完了後に即廃棄。

**実装:**
- Canvas API による前処理（グレースケール、適応的二値化）
- 解析済みテキストのみ Supabase に保存
- サムネイル（100px幅）のみ保持、高解像度画像は保存しない

### Offline Integrity
**原則:** ユーザーが「機内モード」でも解析が動作するアーキテクチャ。

**実装:**
- Tesseract.js + OpenCV.js の CDN ロード（async, 非ブロッキング）
- npm fallback で CDN 失敗時も動作
- WASM 初期化の isLoading ステート管理

---

## 3. 技術スタック（最新仕様準拠）

### Frontend Framework
- **Next.js 16** (App Router)
- **React 19** (Latest)
- **Tailwind CSS v4** (CSS-first, no twMerge needed)
- **TypeScript** (Strict mode)

### WASM & Image Processing
- **Tesseract.js v5** (WebWorker Singleton pattern)
  - Languages: Japanese + English
  - OEM 1 (LSTM neural networks)
  - Automatic orientation detection (OSD)

- **OpenCV.js v4.5.0** (Phase 2+)
  - Perspective transform
  - Adaptive thresholding
  - Orientation correction
  - Denoising

### Backend & Database
- **Supabase** (PostgreSQL)
- **Row-Level Security (RLS)** on business_cards table
- **Realtime listeners** for live sync

### Deployment
- **Vercel** (Next.js optimized)
- **Edge Functions** (optional, for future)

---

## 4. インテリジェント・画像パイプライン

### Phase 1: Canvas-based Preprocessing (✓ Implemented)

**Grayscale Conversion:**
```
ITU-R BT.601: gray = 0.299R + 0.587G + 0.114B
```

**Adaptive Thresholding (Bradley Algorithm):**
```
For each pixel P:
  LocalMean = average of 20×20 neighborhood
  Binary = P > (LocalMean - 5) ? 255 : 0
```

**Contrast Enhancement:**
```
Histogram stretching: stretch [min, max] to [0, 255]
```

**Implementation:** `src/lib/imageProcessor.ts`
- Integral image computation for O(n) local statistics
- Adaptive threshold offset: -5 (tuned for 300-400 DPI cards)
- Handles variable lighting, shadows, reflections

### Phase 2: OpenCV.js Pipeline (Hook Points Ready)

**Perspective Transform:**
- Contour detection on binary image
- 4-corner detection via Hough-line
- Warp to 4:3 aspect ratio document

**Orientation Correction:**
- Text direction analysis (horizontal vs vertical)
- Rotation correction via Hough transform
- Dynamic PSM selection (PSM 1 for mixed)

**Denoising:**
- Morphological operations (erode/dilate)
- Connected component analysis
- Noise elimination (<10px components)

**Implementation Status:** Hook points in `src/lib/image/processor.ts`

---

## 5. OCR エンジン仕様（Tesseract.js）

### Worker Configuration

```typescript
// Engine: Tesseract.js v5 with LSTM
createWorker(["jpn", "eng"], 1, {
  logger: () => {},        // Suppress verbose output
  errorHandler: () => {},  // Handle errors gracefully
})
```

### Page Segmentation Mode (PSM)

| Mode | Use Case | Status |
|------|----------|--------|
| **PSM 1** | Auto + OSD (mixed orientation) | ✓ Auto-detected |
| **PSM 3** | Full auto segmentation | Default |
| **PSM 6** | Single uniform text block | Fallback |

**Mixed Text Orientation:**
- Automatic OSD (Orientation & Script Detection) via Tesseract v5
- No explicit PSM configuration needed
- Handles vertical (縦書き) + horizontal (横書き) seamlessly

### Timeout Management

```typescript
// Global timeout: 60 seconds per card
await withTimeout(
  analyzeBusinessCard(processed),
  60_000,
  "OCR解析がタイムアウトしました"
);
```

### Web Worker Implementation

```typescript
// Singleton pattern to prevent memory leaks
let worker: Worker | null = null;
let initPromise: Promise<Worker> | null = null;

export async function getOCRWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const w = await TesseractLib.createWorker(["jpn", "eng"], 1, {...});
    worker = w;
    return w;
  })();

  return initPromise;
}
```

---

## 6. WASM 初期化 & 技術スタック対応（✓ Implemented）

### CDN Loading Strategy

```typescript
// src/app/layout.tsx (Server Component)
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" async />
<script src="https://docs.opencv.org/4.5.0/opencv.js" async />
```

### Global WASM State Management

```typescript
// src/hooks/useWASMInit.ts
type WASMStatus =
  | { state: "idle" }
  | { state: "initializing"; library: "tesseract" | "opencv" }
  | { state: "ready"; tesseract: boolean; opencv: boolean }
  | { state: "error"; message: string };

// UI: Disable camera input until isWasmReady
<input disabled={!isWasmReady} />
<Toast message="初期化中: WASM ライブラリをロード中..." />
```

### OCR Engine CDN Detection

```typescript
// src/lib/ocr/engine.ts
async function getTesseractLib() {
  if (window.Tesseract) return window.Tesseract;        // CDN ✓
  return await import("tesseract.js");                   // npm fallback
}
```

---

## 7. データ設計（Supabase）

### business_cards Table

```sql
CREATE TABLE business_cards (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),

  -- OCR extracted fields
  full_name VARCHAR(255),
  kana VARCHAR(255),            -- Furigana / reading
  company VARCHAR(255),
  department VARCHAR(255),
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  postal_code VARCHAR(10),
  address TEXT,
  url VARCHAR(255),
  notes TEXT,

  -- Location data
  location_name VARCHAR(255),
  location_lat FLOAT8,
  location_lng FLOAT8,
  location_accuracy_m INT,

  -- Image metadata (minimal)
  thumbnail_base64 TEXT,        -- 100px width, base64 encoded
  source VARCHAR(50),           -- 'camera' | 'manual'

  -- Timestamps
  exchanged_at DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### Row-Level Security (RLS)

```sql
-- Policy: Users can only see their own cards
CREATE POLICY "users_see_own_cards" ON business_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_cards" ON business_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_cards" ON business_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_cards" ON business_cards
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 8. UI/UX フロー

### Screen 1: カメラ入力 (Slate-950 Dark Theme)

```
┌────────────────────────────────┐
│  < 名刺スキャン              │
├────────────────────────────────┤
│                                │
│  📷 [写真を撮る]              │
│                                │
│  ※ PCの場合はファイル選択     │
│                                │
└────────────────────────────────┘
```

**Features:**
- ✓ WASM 初期化完了まで button disabled
- ✓ "初期化中..." tooltip
- ✓ Loading toast during OCR
- ✓ Timeout handling (60s)

### Screen 2: 編集フォーム (Auto-filled)

```
┌────────────────────────────────┐
│  < 名刺スキャン              │
├────────────────────────────────┤
│  プレビュー                    │
│  [🖼️ image with scan beam]     │
│  ✓ 解析完了                   │
├────────────────────────────────┤
│  【氏名（必須）】   【フリガナ】  │
│  [Full Name]        [Kana]     │
│  【会社】【部門】【職種】        │
│  【メール】【電話】【住所】       │
│  【URL】【メモ】                │
├────────────────────────────────┤
│  [撮り直し] [保存]             │
└────────────────────────────────┘
```

**Features:**
- ✓ JSON 形式ではなく、即座にフォームに反映
- ✓ 編集可能なすべてのフィールド
- ✓ 手動アシスト（困難な場合）
- ✓ Supabase へ保存

### Screen 3: リスト表示 & エクスポート

```
┌────────────────────────────────┐
│  + 名刺をもっと追加            │
│  📊 CSVエクスポート            │
│  📱 vCard（.vcf）エクスポート  │
├────────────────────────────────┤
│  [太郎 | 会社A | 営業]         │
│  [花子 | 会社B | 企画]         │
│  [...more cards]               │
└────────────────────────────────┘
```

**Features:**
- ✓ tel:, mailto: links on hover
- ✓ CSV download (all fields)
- ✓ vCard download (per-contact)
- ✓ Nominatim reverse geocoding for GPS→location_name

---

## 9. フェーズ別実装ロードマップ

### ✅ Phase 0: Architecture Foundation (COMPLETE)
- [x] Next.js 16 App Router setup
- [x] Supabase integration + RLS
- [x] Slate-950 UI theme
- [x] Design doc v3.0

### ✅ Phase 1: WASM & Preprocessing (COMPLETE)
- [x] Tesseract.js WebWorker (Singleton)
- [x] Canvas-based preprocessing (grayscale + adaptive thresholding)
- [x] WASM initialization hook (useWASMInit)
- [x] CDN loading + npm fallback
- [x] isLoading state management
- [x] 60s timeout wrapper

### ✅ Phase 2: OCR Engine & Integration (COMPLETE)
- [x] Tesseract configuration (OEM 1, auto-OSD)
- [x] Image preprocessing pipeline
- [x] Error handling + timeout
- [x] Cards/new page integration

### Phase 3: Advanced Image Processing (🔄 In Progress)
- [ ] OpenCV.js perspective transform
- [ ] Hough-line orientation detection
- [ ] Morphological denoising
- [ ] Dynamic PSM selection

### Phase 4: UI/UX Polish & Export
- [ ] Hybrid Picker (tap-to-select assistant UI)
- [ ] CSV export with all fields
- [ ] vCard export (RFC 6350)
- [ ] Email template generation
- [ ] Settings: BYO Supabase config

### Phase 5: Production Hardening
- [ ] Security audit (OWASP top 10)
- [ ] Performance optimization (bundle size)
- [ ] Accessibility (WCAG 2.1)
- [ ] Mobile responsiveness (iOS camera API)
- [ ] Rate limiting + DDoS protection

---

## 10. 実装済み機能レポート

### ✅ セキュリティ
| 機能 | 状態 | 詳細 |
|------|------|------|
| Zero Cloud Extraction | ✓ | Tesseract.js ローカル実行 |
| Privacy by Design | ✓ | メモリ内処理・即廃棄 |
| Offline Integrity | ✓ | CDN + npm fallback |
| RLS on database | ✓ | auth.uid() ポリシー |

### ✅ 画像処理
| 機能 | 状態 | 詳細 |
|------|------|------|
| グレースケール化 | ✓ | ITU-R BT.601 係数 |
| 適応的二値化 | ✓ | Bradley アルゴリズム + 積分画像 |
| コントラスト拡張 | ✓ | ヒストグラムストレッチ |
| Perspective Transform | 🔄 | Hook point ready |
| Orientation Correction | 🔄 | Tesseract auto-OSD |

### ✅ OCR
| 機能 | 状態 | 詳細 |
|------|------|------|
| Tesseract.js | ✓ | OEM 1 (LSTM) |
| WebWorker | ✓ | Singleton pattern |
| PSM Configuration | ✓ | Auto-OSD for mixed text |
| Timeout (60s) | ✓ | withTimeout wrapper |
| Multi-language | ✓ | Japanese + English |

### ✅ UI/UX
| 機能 | 状態 | 詳細 |
|------|------|------|
| WASM isLoading | ✓ | useWASMInit hook |
| Camera input | ✓ | Disabled until ready |
| Toast notifications | ✓ | WASM + user messages |
| Form auto-fill | ✓ | OCR results → fields |
| Slate-950 theme | ✓ | Dark mode optimized |

---

## 11. 開発ガイドライン（守則）

### 禁止事項
- ❌ 外部API（Google/Gemini等）への Fetch 処理
- ❌ クラウド API キーの埋め込み
- ❌ 画像データのサーバー送信
- ❌ OCR 結果以外のデータ収集

### 必須事項
- ✅ すべての画像処理はブラウザ内
- ✅ WASM ライブラリの CDN + fallback
- ✅ isLoading ステート管理
- ✅ Supabase RLS ポリシー
- ✅ TypeScript strict mode
- ✅ Next.js 16 App Router

### パフォーマンス目標
- OCR 処理時間: < 30s（3G接続）
- WASM 初期化: < 5s
- UI レスポンス: < 100ms
- Bundle size: < 2MB（gzip）

---

## 12. セキュリティ宣言

**このアプリは以下を保証します:**

1. **ゼロ クラウド解析**
   - 名刺画像は一切外部に送信されません
   - すべてのOCR処理はあなたのブラウザ内で実行されます

2. **プライバシーファースト**
   - 抽出されたテキスト データのみを Supabase に保存
   - 画像ファイル自体は保存されません
   - 高解像度サムネイルは作成されません

3. **オフライン対応**
   - インターネット接続がなくても、予めロード済みの WASM で解析可能
   - 機内モード、低速・低帯域幅環境に対応

4. **完全オープンソース設計**
   - クローズドな AI モデルに依存しません
   - Tesseract.js（Apache 2.0）+ OpenCV.js（BSD 3-Clause）

---

**Last Updated:** 2026-04-09
**Version:** 3.0 (On-Device Security Edition)
**Status:** Production Ready (Phase 1-2 Complete)
- `location_name`: text（Gemini が座標から変換した地名）
- `location_lat`, `location_lng`, `location_accuracy_m`: float8
- `thumbnail_base64`: text（100px 幅・補正済み画像）
- `created_at`: timestamptz（INDEX）

## 5. OCR & 入力フロー
1. **撮影**: カメラ起動（背面固定）→ 名刺撮影。
2. **整形**: 自動台形補正・回転実行。
3. **解析**: Gemini 2.5 Flash による解析（JSON抽出）。
4. **UX（解析中）**: 画像プレビュー上に「半透明オーバーレイ + スキャンバー（アニメーション）」を重畳し、
   「AIが名刺を解析中...（台形補正・OCR）」を表示して待ち時間の不安を減らす。
5. **編集**: 抽出結果をフォーム表示。ユーザーが画像を見ながら修正・保存。
6. **完了**: DB インサート（upsert）成功後、一覧へ遷移。

## 6. セキュリティ
- **RLS**: 全テーブルに `auth.uid() = user_id` を適用。
- **Privacy**: 元画像は解析後即廃棄。100px サムネイルのみ保持。
- **Prompt Security**: System Instruction による役割固定と JSON Schema 強制。

## 7. ディレクトリ構造 (App Router)
- `src/app/page.tsx`: ダッシュボード（タイル型メニュー）
- `src/app/login/page.tsx`: 認証（ブートストラップ対応）
- `src/app/settings/page.tsx`: 接続設定・プロフィール管理
- `src/app/(dashboard)/cards/page.tsx`: スリムリスト（高密度表示）
- `src/app/(dashboard)/cards/new/page.tsx`: OCR スキャン（アニメーション層あり）
- `src/app/(dashboard)/cards/[id]/page.tsx`: 詳細・編集・AIメール作成
