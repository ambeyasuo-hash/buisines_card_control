あんべの名刺代わり — Design Document v5.0.5
Zero-Knowledge + Searchable Encryption + Elegant Resilience

--------------------------------------------------------------------------------
1. 製品概要
コンセプト: 「軍用レベルの堅牢性と、隣人に寄り添う優しさの共存」
 サーバー管理者が一切のデータを見ることができない「ゼロ知識証明」を貫きつつ、ユーザーが認証に迷った際の救済策を備えた、究極のUXを持つ名刺DXプラットフォーム
。 ターゲット: プライバシー意識の極めて高い法人・コンサルタント・営業職
 技術的特性:
Searchable Encryption (Blind Indexing): データを秘匿したまま、サーバー側での高速な検索・統計を可能にするハイブリッド設計
。
Elegant Rescue: 認証失敗時の絶望を回避するため、端末の電話帳を活用したリカバリ機能を搭載
。
Placeholder-Based AI: Geminiには非PII（個人特定不能）属性のみを送信し、実データとの結合はブラウザ側で完結させる
。

--------------------------------------------------------------------------------
2. セキュリティ・アーキテクチャ (Zero-Knowledge & Recovery)
2.1 分散型多層鍵管理 (Distributed Trust)
メイン認証: WebAuthn（FaceID/指紋認証）により保護された端末内秘密鍵
。
フォールバック: ユーザー設定パスコードから PBKDF2 (HMAC-SHA256, 10万回反復) により派生させた鍵
。
リカバリ: 24単語の物理リカバリキー生成と整合性テストの強制に加え、端末の連絡先に「復旧用パスコード」を自動作成する救済フローを実装
。
2.2 Azure AI Document Intelligence (Japan East)
ローカルOCRを廃止し、AzureのPrebuiltモデルに集約。データ学習・ログ保存はオプトアウト設定済みの法人契約APIを使用
。
解析後の元画像はDBに保存せず、メモリから即座に抹消
。

--------------------------------------------------------------------------------
3. 技術スタック (v5.0.5)
Frontend & Security
Next.js 15/16 (App Router) / Tailwind CSS v4
Encryption: AES-GCM (256-bit)
Hashing: HMAC-SHA256 (Blind Indexing用)
Cloud OCR & AI
Azure AI Document Intelligence (@azure/ai-form-recognizer)
Google Gemini 2.5 Flash: 構造化テンプレート生成のみを担当
Backend
Supabase (PostgreSQL) + RLS (Row Level Security)

--------------------------------------------------------------------------------
4. 解析・検索パイプライン
Extract: Azure OCRにより構造化データを抽出（日本リージョン・学習なし）
。
Normalize: src/lib/normalize.ts を用い、企業名から「株式会社」等のノイズを除去し、検索用単語に分割
。
Client-side Processing:
実データ：AES-GCMで一括暗号化
。
検索ワード：固有ソルトを用いて個別にハッシュ化（Blind Indexing）
。
Storage: サーバーには「暗号化されたデータ」と「比較用のハッシュ」、「非PII属性（業界等）」のみを送信
。
AI Generation & Hydration: 属性に基づき生成された「{{氏名}}」入りテンプレートを、ブラウザ上で実データと結合
。

--------------------------------------------------------------------------------
5. データ設計（Supabase）
business_cards Table
[E2EE Zone: 復号鍵が必須]
encrypted_data: PII一括暗号化JSON
encrypted_thumbnail: 暗号化済みサムネイルBase64
[Search Zone: 盲目的索引]
search_hashes: 名字、名前、社名の個別HMACハッシュ（配列格納）
[Analytics Zone: 統計用平文]
industry_category: 業界カテゴリ（IT、製造等）
attributes: 役職ランク、ミッション等の非PII属性
[Security & Recovery]
encryption_salt: ユーザー固有UUIDソルト
auth_verify_hash: パスコード検証用ハッシュ
recovery_hash: シードフレーズ検証用ハッシュ

--------------------------------------------------------------------------------
6. UI/UX デザイン規格 (Ambe Design System)
Layout: モバイルセントリック（最大幅 600px）を厳守
。
Visual Trust: 鍵生成プロセスをアニメーション化し、「セキュリティ・コンテキストを構築中」と表示して安心感を可視化
。
Slots: 「What's New（更新情報）」、「自己紹介・実績（Identity）」、「AIコンシェルジュ（取説）」の各スロットを配置
。

--------------------------------------------------------------------------------
Version: 5.0.5 Phoenix Edition (Elegant Resilience) Status: Implementation Ready (c) 2026 ambe / Business_Card_Folder