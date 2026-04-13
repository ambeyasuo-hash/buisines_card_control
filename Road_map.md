Road_map.md: Business Card Folder (v5.0.5 Phoenix Edition)
📌 開発戦略: 「段階的モック・ファースト」
スレッド分離: 各フェーズ終了ごとにスレッド（会話）をリセットし、トークン上限を回避。
コンテキスト最小化: 各スレッドの冒頭で design_doc.md と Road_map.md の当該箇所のみを読み込ませる。
ロジック分離: UI（優しさ）とセキュリティ（堅牢性）を分けて実装し、最後に結合する。
🛠 フェーズ 1: 基盤構築とデザインシステム (UI Mock-up)
目的: 600px制限のUIを確定させ、ユーザー体験を可視化する。

Step 1-1: ディレクトリ構造の再定義と Shadcn UI / Tailwind のセットアップ。

Step 1-2: MobileContainer (最大600px中央寄せ) と共通レイアウトの実装。

Step 1-3: モック画面の実装 (静的データ)
Identity Page (安部氏プロフ & vCard)
Dashboard (カード一覧 & 検索バー)
Scan UI (カメラ起動ダミー)

Step 1-4: src/lib/normalize.ts の実装 (検索・正規化の核)
🔐 フェーズ 2: セキュリティ・プロトコル (Robust Logic)
目的: サーバーから中身が見えない「ゼロ知識証明」の暗号化基盤を作る。

Step 2-1: src/lib/crypto.ts の実装 (AES-GCM / PBKDF2 / HMAC)。

Step 2-2: 鍵生成プロセスの可視化アニメーション (UXコンテキスト)。

Step 2-3: WebAuthn (メイン) と パスコード (フォールバック) の認証フロー構築。
📡 フェーズ 3: データ・インテグレーション (Backend & OCR)
目的: SupabaseとAzure OCRを連携させ、暗号化データを保存・検索可能にする。

Step 3-1: Supabase テーブルスキーマの適用 (E2EE Zone / Analytics Zone)。

Step 3-2: Azure OCR (日本リージョン) による構造化データ抽出の実装。

Step 3-3: 抽出データの「ブラウザ側一括暗号化」と「ハッシュ分割送信」の実装。
🚑 フェーズ 4: リカバリ・エクスペリエンス (Elegant Rescue)
目的: 絶望を回避させる「隣人への優しさ」を実装する。

Step 4-1: 電話帳連携リカバリ機能 (vCard形式での「救済の鍵」出力)。

Step 4-2: 認証失敗時のガイドUIの実装。

Step 4-3: 物理リカバリキー (24単語) の生成と整合性テスト。
🚀 フェーズ 5: 最終調整とデプロイ

Step 5-1: 安部氏専用コンシェルジュ (NotebookLM) への導線設置。

Step 5-2: Vercel デプロイと、シークレット環境変数の最終確認。

Step 5-3: PII（個人情報）が平文で通信・保存されていないかの最終監査。