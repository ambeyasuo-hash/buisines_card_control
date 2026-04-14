Roadmap.md: Business Card Folder (v5.0.7 Phoenix Edition)
📌 開発戦略: 「アトミック・インテグレーション」

スレッド最適化: コンテキスト肥大化を防ぐため、1タスク完了ごとに新スレッドへの移行を推奨。

Zero-Knowledge 徹底: 暗号化・復号の主権は常にクライアント側に置く。

リソース管理: iOS Safari等の特定環境におけるハードウェア解放を厳格に管理。

✅ フェーズ 1: 基盤構築とデザインシステム (Complete)
[x] Step 1-1: ディレクトリ構造定義と Shadcn UI / Tailwind セットアップ。

[x] Step 1-2: MobileContainer (最大600px中央寄せ) 実装。

[x] Step 1-3: Identity / Dashboard / Scan の各モック画面実装。

[x] Step 1-4: 検索・正規化用 normalize.ts の基礎実装。

✅ フェーズ 2: セキュリティ・プロトコル (Complete)
[x] Step 2-1: crypto.ts (AES-GCM / PBKDF2) による暗号化基盤の実装。

[x] Step 2-2: 鍵管理フローの策定（localStorage 優先、環境変数非依存）。

[x] Step 2-3: 認証情報のクライアントサイド保持とリクエスト注入。

📡 フェーズ 3: データ・インテグレーション & 安定化 (Current)
目的: 実データと暗号化ロジックを統合し、実運用可能な「名刺管理」を完成させる。

[x] Step 3-1: Supabase クライアント最適化

シングルトン化による重複インスタンス警告の解消。

auth: { storageKey: 'phoenix-auth-token' } による競合回避。

[x] Step 3-2: カメラ制御の堅牢化 (iOS Ready)

AnimatePresence 競合の解消と rAF リトライループの実装。

再起動時の 80ms ディレイによるハードウェア解放待ち。

[x] Step 3-3: ゼロ知識・一覧表示 (Zero-Knowledge List)

取得した encrypted_data を端末内のマスターキーで復号・表示。

復号失敗時のエラーハンドリングと、キャッシュ（no-store）の制御。

[x] Step 3-4: Azure OCR パイプラインの最終化

OCR抽出データから PII を除外した上での、クライアントサイド一括暗号化保存。

✅ フェーズ 3.5: 検索・詳細表示・リカバリ (Optimize & Enhance) [COMPLETE]
目的: Dashboard 検索ロジックの最適化、詳細表示モーダルの実装、リカバリ導線の強化。

[x] Step 3.5-1: 検索ロジック最適化（normalize.ts の統合）

大文字・小文字・全角・半角・日本語混在への対応。

tokenizeForSearch による部分一致・トークンベース検索。

[x] Step 3.5-2: 詳細表示モーダル（Detail View）の実装

カードをタップして復号済み全フィールドを表示。

コピー機能付き（Zero-Knowledge 維持）。

[x] Step 3.5-3: リカバリ導線の強化

Supabase 未設定時：設定画面へのボタン表示。

エラー発生時：再試行 + 設定確認ボタン。

✅ フェーズ 4: リカバリ & PWA (Complete)
目的: 端末紛失・キー喪失時の救済と、オフライン利便性の向上。

[x] Step 4-1: 検索・フィルタ精度の向上

サーチハッシュの活用（サーバーサイド検索の最適化）。

カテゴリフィルタ（industry_category の実装）。

[ ] Step 4-2: PWA 基盤の実装 & マニフェスト設定。

[x] Step 4-3: 物理リカバリキー (24単語) の生成とエクスポート。

BIP-39 標準 (@scure/bip39) で AES-256 キー → 24単語シークレットフレーズへ変換。

src/lib/mnemonic.ts に keyB64ToMnemonic / mnemonicToKeyB64 / isValidMnemonic を実装。

フレーズの表示/非表示トグル、クリップボードコピーを IdentityPage に実装。

[x] Step 4-4: 救済用 vCard 出力機能。

vCard 3.0 形式（FN: あんべの名刺代わり・復号キー、NOTE: シークレットフレーズ）を生成。

Web Share API (iOS Safari 対応) → ダウンロードのフォールバック で「連絡先に保存」を実装。

[x] Step 4-5: 自分宛メール送信 (mailto) 機能。

件名「【バックアップ】あんべの名刺代わり・復号キー」、フレーズ入り本文を mailto: で起動。

クライアントサイド専用。Zero-Knowledge 厳守。

🏆 フェーズ 5: 最終監査とデプロイ (Complete — v5.1.0 Stable)
目的: Phase 4 完了後、本番環境へのデプロイ前の最終検証と監査。

[x] Step 5-1: 開発ログクリーンアップ (Completed)
[x] console.log / console.error 全除去
[x] IdentityPage.tsx, save-business-card, azure/analyze, azure/test クリーン化
[x] azure/test/route.ts を削除（デプロイ不要ファイル）

[x] Step 5-2: Zero-Knowledge 最終防衛検証 (Completed)
[x] vCard 生成: 復号キー(mnemonic)のみ、PII 未含有 ✅
[x] mailto: クライアント専用、平文送信なし ✅
[x] クリップボードコピー: 復号キーのみ、PII 未含有 ✅
[x] Dashboard 復号: localStorage キー使用、暗号化データのみ Supabase 送受信 ✅

[x] Step 5-3: PII（個人情報）漏洩がないかの通信トラフィック最終監査。

✅ Supabase API への送信: 暗号化済み encrypted_data + search_hashes（個人特定不可）のみ
✅ Azure OCR へのリクエスト: image/jpeg のみ (PII なし) → レスポンス後即座に暗号化
✅ クライアント側秘密鍵: localStorage のみ保持、サーバーに送信されない
✅ 環境変数方式: 廃止、リクエストボディからの認証情報転送で Zero-Knowledge 厳守
✅ 通信経路: 平文 PII は 1 bit も流れない（監査合格）

[x] Step 5-4: Production デプロイ準備完了。

[x] main ブランチにコミット (デプロイ対象ファイルのみ)
[x] Vercel に .env.local は不要（環境変数なし設計）
[x] GitHub auto-deploy 有効化済み (CI/CD パス)
[x] デプロイ検証対象: https://ambe-business-card.vercel.app