// (c) 2026 ambe / Business_Card_Folder

# あんべの名刺代わり — Design Document v4.0
## Zero-Knowledge + Cloud-Hybrid Architecture

---

## 1. 製品概要

**コンセプト:** 「配布可能な信頼」

ゼロ知識アーキテクチャを採用し、個人特定情報（PII）を一切 AI に学習させないセキュアな名刺管理ツール。

**ターゲット:** プライバシー意識の高い法人・コンサルタント・営業職

**技術的特性:**
- **Zero-Knowledge OCR**: 画像は Azure AI にのみ送信（学習禁止）
- **Placeholder-Based AI**: 名刺データは一切 LLM に送信しない（テンプレート変数のみ）
- **PII Masking**: 属性情報のみ AI に送信、実データはブラウザで結合
- **Offline Support**: 前回スキャン結果から再生成可能（テンプレート再適用）

---

## 2. セキュリティ・アーキテクチャ (Zero-Knowledge Architecture)

本製品は「配布可能な信頼」を担保するため、以下の二重のガードレールを採用する。

### 2.1 Azure AI Document Intelligence (Japan East)

**方針:**
- **Prebuilt Business Card** モデルで OCR と構造化を一気通貫。
- データの学習利用・ログ保存を明示的に禁止（オプトアウト）した法人向けAPI。
- 画像は Azure にのみ送信、テキスト抽出後は即座に削除。

**実装:**
```typescript
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";

const client = new DocumentAnalysisClient(endpoint, credential);
const poller = await client.beginAnalyzeDocumentFromUrl(
  "prebuilt-businessCard",
  imageUrl,
  { locale: "ja-JP" }
);

const result = await poller.pollUntilDone();
// Extract: name, company, title, phone, email, address, website
```

**セキュリティ保証:**
- ✅ データ保持期間: 24 時間以内に削除
- ✅ 学習利用: 一切使用されない（オプトアウト API）
- ✅ 地域制限: Japan East (データ主権)

### 2.2 Placeholder-Based Email Generation

**方針:**
- 外部LLM（メールドラフト生成）には個人特定情報（氏名、社名、連絡先）を**一切渡さない**。
- AI には「変数付きテンプレート」を生成させるのみ。
- 実データの結合は「ユーザーのブラウザ上」でのみ実行。

**データフロー:**
```
抽出データ (PII)
  ↓
[Supabase RLS] ← 即座に格納、保護
  ↓
属性抽出 (役職、業界、ミッション)
  ↓
[Gemini 2.5 Flash] → テンプレート生成のみ
  ↓
ブラウザ上で結合 (変数置換)
  ↓
ユーザー確認・送信
```

**実装例:**
```typescript
// AI へ送信 (PII 除去)
const prompt = `
あなたは営業メールの専門家です。
相手の役職: {{職種}}
相手の業界: {{業界}}
こちらのサービス: {{サービス}}
に基づき、メールテンプレートを作成してください。
変数は {{変数名}} の形式で残してください。
`;

const response = await gemini.generateContent(prompt);
// → 出力例: "{{相手名}}様へ、いつもお世話になっています..."

// ブラウザで実データを結合
const finalEmail = response.text
  .replace("{{相手名}}", cardData.full_name)
  .replace("{{職種}}", cardData.title)
  // ...
```

### 2.3 PII Masking Pipeline

**段階 1: OCR 抽出**
```
Azure AI → {
  full_name: "太郎",
  company: "太郎商事",
  title: "営業部長",
  email: "taro@tarojp.co",
  phone: "+81-90-XXXX-XXXX",
  address: "東京都渋谷区..."
}
```

**段階 2: RLS 保護下で Supabase 保存**
```sql
-- Row-Level Security: auth.uid() 以外はアクセス不可
INSERT INTO business_cards (user_id, full_name, company, ...)
VALUES (auth.uid(), ...)
```

**段階 3: 属性のみ抽出 (AI へ送信)**
```typescript
const attributes = {
  role: cardData.title,           // "営業部長" → "営業"
  industry: detectIndustry(cardData.company), // 業界推定
  mission: userSelectedCategory,
};
// PII (氏名、社名、連絡先) は一切含まない
```

### 2.4 Offline Recoverability

**方針:**
- 前回スキャン結果から、テンプレートを再適用してメール再生成。
- インターネット接続なしでも基本機能は動作。

**実装:**
```typescript
export async function regenerateEmailFromCache(cardId: string) {
  // 1. Supabase から前回の抽出結果を取得
  const cachedCard = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", cardId)
    .single();

  // 2. 保存済みのテンプレートを使用
  const template = await supabase
    .from("user_settings")
    .select("email_template")
    .single();

  // 3. ブラウザで結合
  return applyTemplate(template, cachedCard);
}

---

## 3. 技術スタック (v4.0)

### Frontend Framework
- **Next.js 16** (App Router, SSR/SSG)
- **React 19** (Latest)
- **Tailwind CSS v4** (CSS-first)
- **TypeScript** (Strict mode)
- **Lucide React** (Icons)

### Cloud OCR & AI
- **Azure AI Document Intelligence** (@azure/ai-form-recognizer)
  - Model: Prebuilt Business Card
  - Endpoint: Japan East (Data Residency)
  - Auth: AzureKeyCredential (API Key via env)

- **Google Gemini 2.5 Flash** (@google/generative-ai)
  - Mode: Placeholder-Based (PII-Free)
  - Usage: Email template generation only
  - Pricing: Pay-as-you-go (推奨)

### Backend & Database
- **Supabase** (PostgreSQL, Realtime)
  - RLS: auth.uid() = user_id on all tables
  - Realtime: Business cards sync across devices
  - Auth: Email/Password + Magic Link

### Image Processing (Legacy)
- **Canvas API** (Grayscale, thresholding)
- **Tesseract.js** (Fallback OCR if Azure fails)
- **OpenCV.js** (Phase 2: Perspective correction)

### Deployment & Monitoring
- **Vercel** (Next.js CDN, Edge Functions)
- **Sentry** (Error tracking, optional)
- **DataDog** (Usage monitoring, optional)

---

## 4. OCR・解析パイプライン (v4.0)

### フロー図

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Input: 背面カメラより名刺撮影                           │
│    ✓ WASM isLoading 完了まで待機                          │
│    ✓ ユーザー確認 (プレビュー)                             │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Analysis: Azure AI Document Intelligence (Prebuilt)      │
│    ✓ 名刺画像を Japan East に送信                         │
│    ✓ OCR + 構造化抽出 (1回の API 呼び出し)               │
│    ✓ 24 時間以内に画像削除（契約保証）                    │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Storage: PII 即座に Supabase に RLS 保護下で格納       │
│    ✓ full_name, company, email, phone, etc.               │
│    ✓ thumbnail_base64 (100px, 軽量)                      │
│    ✓ ユーザーのみアクセス可能（RLS ポリシー）             │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Masking: 属性抽出（AI へ送信する情報は PII 除去）      │
│    ✓ role: "営業部長" → "営業"                            │
│    ✓ industry: 企業ドメイン → 業種推定                    │
│    ✓ mission: ユーザーが選択したカテゴリ                  │
│    ✗ 氏名、社名、連絡先は一切含まない                     │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. AI Generation: Gemini 2.5 Flash (テンプレート生成のみ) │
│    ✓ Prompt に属性と変数テンプレート形式を指定           │
│    ✓ 出力: "{{氏名}}様へ、{{役職}}のご担当者様..." (無実名)│
│    ✓ AI は実データを一切学習しない                        │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Hydration: ブラウザ上で実データと結合                   │
│    ✓ テンプレート内の {{変数}} を Supabase から取得した  │
│      実データで置換                                        │
│    ✓ 置換後の完成メールをユーザーに提示                   │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Export & Sync: ユーザー確認後にメール送信・保存        │
│    ✓ メール内容 → Supabase に保存                        │
│    ✓ Realtime Listeners で複数デバイス同期               │
└─────────────────────────────────────────────────────────────┘
```

### 各ステップの詳細実装

#### Step 2: Azure API 呼び出し

```typescript
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";

export async function analyzeBusinessCardWithAzure(
  imageUrl: string
): Promise<BusinessCardData> {
  const client = new DocumentAnalysisClient(
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT!,
    new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY!)
  );

  const poller = await client.beginAnalyzeDocumentFromUrl(
    "prebuilt-businessCard",
    imageUrl,
    {
      locale: "ja-JP",
    }
  );

  const result = await poller.pollUntilDone();

  // 構造化データの抽出
  return {
    full_name: result.documents[0].fields.ContactNames?.[0]?.content,
    company: result.documents[0].fields.CompanyNames?.[0]?.content,
    title: result.documents[0].fields.JobTitles?.[0]?.content,
    email: result.documents[0].fields.Emails?.[0]?.content,
    phone: result.documents[0].fields.PhoneNumbers?.[0]?.content,
    address: result.documents[0].fields.Addresses?.[0]?.content,
    website: result.documents[0].fields.Websites?.[0]?.content,
  };
}
```

#### Step 4: 属性抽出 (PII マスキング)

```typescript
export async function extractAttributes(
  cardData: BusinessCardData
): Promise<AttributesMasked> {
  // Role extraction
  const role = extractRole(cardData.title);
  // "営業部長" → "営業"

  // Industry inference
  const industry = detectIndustryFromDomain(cardData.email || cardData.website);
  // "taro@tarojp.co" → "商社" or "製造業"

  // Mission (user-selected category)
  const mission = (await supabase
    .from("business_cards")
    .select("category->mission")
    .single()).data?.mission;

  return { role, industry, mission };
  // ✓ PII なし、属性のみ返却
}
```

#### Step 5: Gemini によるテンプレート生成

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateEmailTemplate(
  attributes: AttributesMasked
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
あなたは営業メールの専門家です。
以下の属性に基づき、メールテンプレートを作成してください。

【属性】
- 役職レベル: ${attributes.role}
- 業界: ${attributes.industry}
- こちらの提案: ${attributes.mission}

【指示】
- メール本文を作成してください
- 人名は {{氏名}} という形式で変数化してください
- 企業名は {{企業名}} で変数化してください
- 役職は {{役職}} で変数化してください
- 実際のデータを一切含めないでください
- 敬語を丁寧に、営業らしい温かいトーンで

【出力形式】
件名:
本文:
`;

  const response = await model.generateContent(prompt);
  return response.response.text();
  // → 出力例: "件名: {{氏名}}様へのご提案
  //           本文: {{氏名}}様へ、いつもお世話になっております..."
}
```

#### Step 6: ブラウザで実データを結合 (Hydration)

```typescript
export function hydrateEmailTemplate(
  template: string,
  cardData: BusinessCardData
): string {
  return template
    .replace(/{{氏名}}/g, cardData.full_name || "")
    .replace(/{{企業名}}/g, cardData.company || "")
    .replace(/{{役職}}/g, cardData.title || "")
    .replace(/{{メール}}/g, cardData.email || "")
    .replace(/{{電話}}/g, cardData.phone || "");
  // ✓ すべてブラウザで実行、サーバーに送信しない
}
```

---

## 5. インテリジェント・画像パイプライン (Legacy/Fallback)

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

## 10. フェーズ別実装ロードマップ (v4.0)

### ✅ Phase 0: Foundation (COMPLETE)
- [x] Next.js 16 App Router + SSR
- [x] Supabase PostgreSQL + RLS
- [x] Slate-950 Dark UI theme
- [x] Tesseract.js Singleton (Fallback OCR)
- [x] Canvas preprocessing (Grayscale + Adaptive Threshold)

### ✅ Phase 1: Hybrid Cloud-Local Architecture (CURRENT)
- [x] Azure AI Document Intelligence integration (@azure/ai-form-recognizer)
- [x] Japan East endpoint + Data residency
- [x] Prebuilt Business Card model for 1-shot OCR
- [x] Error handling + Tesseract.js fallback
- [x] RLS-protected PII storage (Supabase)

### Phase 2: Placeholder-Based Email Generation (🔄 NEXT)
- [ ] Google Gemini 2.5 Flash integration (@google/generative-ai)
- [ ] Attribute extraction (Role, Industry, Mission)
- [ ] PII masking pipeline
- [ ] Template generation with {{variable}} format
- [ ] Browser-side hydration (data merging)
- [ ] Email preview + user confirmation UI

### Phase 3: Advanced Features
- [ ] CSV export (all fields + timestamps)
- [ ] vCard export (RFC 6350)
- [ ] Offline email regeneration (cached templates)
- [ ] Category-based email tone customization
- [ ] Multi-language support (JA, EN, ZH)

### Phase 4: Mobile & Accessibility
- [ ] iOS camera permissions handling
- [ ] Android ACTION_IMAGE_CAPTURE integration
- [ ] WCAG 2.1 AA compliance
- [ ] Screen reader support
- [ ] Keyboard navigation

### Phase 5: Production & Security Hardening
- [ ] Security audit (OWASP Top 10)
- [ ] Rate limiting (Azure API, Gemini API)
- [ ] DDoS protection (Vercel Shield)
- [ ] Sentry error tracking setup
- [ ] DataDog usage monitoring
- [ ] SOC 2 / ISO 27001 readiness

---

## 11. 実装済み機能レポート (v4.0)

### ✅ セキュリティ (Zero-Knowledge)
| 機能 | 状態 | 詳細 |
|------|------|------|
| Azure AI (Japan East) | ✓ | Data residency + Learning opt-out |
| PII Masking | ✓ | 属性のみ AI に送信 |
| RLS Protection | ✓ | auth.uid() = user_id on all tables |
| Placeholder AI | 🔄 | Gemini テンプレート生成 |
| Offline Recoverability | 🔄 | キャッシュから再生成 |

### ✅ OCR Pipeline (Hybrid)
| 機能 | 状態 | 詳細 |
|------|------|------|
| Azure Prebuilt | ✓ | Business Card model, JSON extraction |
| Fallback Tesseract | ✓ | OEM 1, WebWorker Singleton |
| Error Recovery | ✓ | Azure fail → Tesseract fallback |
| Timeout Management | ✓ | 60s per card |
| Multi-language | ✓ | Japanese + English |

### ✅ 画像処理 (Canvas-based)
| 機能 | 状態 | 詳細 |
|------|------|------|
| Grayscale | ✓ | ITU-R BT.601 |
| Adaptive Threshold | ✓ | Bradley + Integral Image |
| Contrast Stretch | ✓ | Histogram equalization |
| WASM init | ✓ | useWASMInit hook |

### 🔄 Email Generation (In Progress)
| 機能 | 状態 | 詳細 |
|------|------|------|
| Gemini 2.5 Flash | 🔄 | Template generation |
| Attribute Extraction | 🔄 | Role, Industry, Mission |
| Hydration (Merge) | 🔄 | Browser-side data binding |
| User Confirmation | 🔄 | Preview + edit UI |
| Realtime Sync | 🔄 | Multi-device sync |

### ✅ UI/UX (Slate-950 Theme)
| 機能 | 状態 | 詳細 |
|------|------|------|
| Dark Mode | ✓ | High contrast, outdoor-optimized |
| Camera Input | ✓ | Disabled until WASM ready |
| Form Auto-fill | ✓ | OCR results → Input |
| Toast Messages | ✓ | Loading + error feedback |
| RLS Protection | ✓ | ユーザーデータ分離 |

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

## 12. セキュリティ宣言 (v4.0)

**このアプリは以下を保証します:**

### 1. ゼロ知識 OCR
- 名刺画像は **Azure AI Document Intelligence** にのみ送信
- 画像は **24時間以内に自動削除** （契約保証）
- **学習利用禁止** （オプトアウト API を使用）
- ✅ Microsoft Japan での日本語対応 (Japan East endpoint)

### 2. AI からのプライバシー隔離
- **個人特定情報（PII）は絶対に AI に送信されません**
  - 氏名、社名、連絡先、メールアドレスは Supabase に隔離
- **属性情報のみ** AI に送信
  - 役職レベル（営業、管理、技術など）
  - 業界推定（商社、製造、IT など）
  - ユーザーが選択したカテゴリ
- AI は**テンプレート**のみ生成（実データを含まない）
- 実データとの結合は **ユーザーのブラウザ上でのみ実行**

### 3. データ主権 & RLS
- すべてのユーザーデータは Supabase（PostgreSQL）に保存
- **Row-Level Security**: auth.uid() 以外はアクセス不可
- 他のユーザーのデータを一切閲覧不可（システム側でも）
- 暗号化転送（TLS 1.3）

### 4. オフライン対応 & Recoverability
- インターネット接続なしでも基本機能は動作
- 前回スキャン結果から、保存済みテンプレートで再生成可能
- Tesseract.js フォールバック（Azure API 失敗時）

### 5. 透明性 & オープン標準
- コード + 設定はすべて確認可能（GitHub）
- Tesseract.js（Apache 2.0）+ OpenCV.js（BSD 3-Clause）
- Azure SDK（MIT）+ Gemini SDK（Apache 2.0）

---

## 13. 環境変数設定 (v4.0)

```env
# Azure AI Document Intelligence
AZURE_FORM_RECOGNIZER_ENDPOINT=https://[region].api.cognitive.microsoft.com/
AZURE_FORM_RECOGNIZER_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Monitoring
SENTRY_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

**Last Updated:** 2026-04-09
**Version:** 4.0 (Zero-Knowledge + Cloud-Hybrid Architecture)
**Status:** Phase 1-2 Complete, Phase 2 (Email Generation) In Progress
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
