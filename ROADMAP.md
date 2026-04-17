# ROADMAP.md — Phoenix Edition v5.0.6+
// (c) 2026 ambe / Business_Card_Folder

---

## ✅ Phase 1: Zero-Knowledge 基盤構築 (Completed)
- [x] 1.1 端末主権型アーキテクチャ設計
- [x] 1.2 localStorage による API キー管理 (Azure / Supabase)
- [x] 1.3 Supabase クライアントファクトリ (`src/lib/supabase-client.ts`)
- [x] 1.4 設定画面実装 (SettingsPage.tsx) — SQL ウィザード付き

## ✅ Phase 2: スキャン & OCR パイプライン (Completed)
- [x] 2.1 横持ち最適化カメラ UI (scan/page.tsx)
- [x] 2.2 Azure Document Intelligence 統合 (prebuilt-businessCard / prebuilt-read)
- [x] 2.3 Sharp によるサーバーサイド画像前処理 (EXIF 回転 / コントラスト補正)
- [x] 2.4 表面 + 裏面の二段階スキャンフロー
- [x] 2.5 撮影後カメラ即時解放 / 横持ちロック動的制御

## ✅ Phase 3: E2EE データ永続化 (Completed)

### 3.1 クライアントサイド暗号化
- [x] `src/lib/crypto.ts` — AES-256-GCM (Web Crypto API)
- [x] `getOrCreateEncryptionKey` — localStorage からキー取得 / 初回生成
- [x] `encryptData / decryptData` — "v1:\<iv\>:\<ciphertext\>" フォーマット
- [x] 保存前に端末内で暗号化 → PII はネットワークに一切流れない

### 3.2 暗号化キーリカバリ
- [x] `src/lib/vcf.ts` — vCard 3.0 形式でキーを電話帳に保存
- [x] Web Share API (モバイル) / ダウンロード (デスクトップ) フォールバック
- [x] 設定画面に「暗号化キー管理」セクション追加
  - キー生成済みバッジ / 電話帳バックアップ / 再生成 (確認付き)

### 3.3 Supabase 保存 API (Zero-Knowledge プロキシ)
- [x] `POST /api/save-business-card` — encrypted_data のみ受け取る薄いプロキシ
- [x] Supabase URL/Key はリクエストボディで転送 (process.env 不使用)
- [x] Supabase SQL スキーマ更新 (user_id nullable / anon RLS / GRANT anon)

### 3.4 Supabase クライアント最適化 ← **2026-04-14 完了**
- [x] **シングルトンパターン実装** — モジュールスコープで `_instance` をキャッシュ
  - 同一 URL + Key なら既存インスタンスを再利用 → **重複 GoTrueClient 警告解消**
  - URL/Key 変更時は自動再生成 (stale インスタンス問題を防止)
- [x] **`auth.storageKey: 'phoenix-auth-token'`** を明示指定
  - デフォルトの `sb-<projectId>-auth-token` では複数プロジェクト間で競合する可能性
  - 固有キーで物理的にコンテキスト競合を回避
- [x] **`invalidateSupabaseClient()`** エクスポート
  - 設定クリア (`handleClearAll`) 時にキャッシュを明示的に破棄
- [x] **全スキャン確認**: `createClient` 直接呼び出しは `route.ts` (サーバー専用プロキシ) のみ
  - `check-connection.ts` は raw `fetch()` を使用 → 影響なし
  - `.tsx` ファイルに直接 `createClient` 呼び出しなし

## ✅ Phase 3.5: 一覧・閲覧 UI ← **2026-04-14 完了**
**保存済みデータの一覧表示における Zero-Knowledge 復号の完全統合と安定化**

データフロー確認:
- [x] 3.5.1 復号ロジック共通化 — Dashboard.tsx で Supabase から encrypted_data を取得
- [x] 3.5.2 端末内復号 — Web Crypto API + localStorage のマスターキーで AES-256-GCM 復号
- [x] 3.5.3 データ不整合排除 — 復号失敗カードはガード節で除外 + エラーバナー表示
- [x] 3.5.4 ローディング・空状態 — スケルトン表示 + 「名刺をスキャンしてください」誘導 UI
- [x] 3.5.5 サムネイル表示 — 64×40px / object-fit:cover / 縦横名刺対応
- [x] 3.5.6 検索・ソート — クライアント側で復号済みデータに実行

## 🟦 Phase 4: 検索・フィルタ・詳細 (Planned)
**業種フィルタ + 詳細画面 + 連携アクション**

## 🟧 Phase 5: 拡張機能 (Planned)
- [ ] 5.1 industry_category の自動分類 (Gemini によるカテゴリ推定)
- [ ] 5.2 業種フィルタチップの有効化
- [ ] 5.3 名刺詳細画面 / インライン編集 / 削除
- [ ] 5.4 電話 (`tel:`) / メール (`mailto:`) ワンタップアクション
- [ ] 5.5 vCard エクスポート (個別名刺を連絡先へ追加)
- [ ] 5.6 CSV エクスポート (全件一括)

## 🟪 Phase 6: Biometric Security & PAA Integration (Core Logic 完成、UI 統合進行中)

**目標**: WebAuthn（Passkey）による生体認証を実装し、マスターキーを Secure Enclave で二重保護。「キャッシュ抜き出し」攻撃を物理的に無効化しつつ、「あんべの名刺代わり」にふさわしい軽快なUXを実現。

**依存**: Phase 3.5 完了（Dashboard 一覧表示確定）

**実装進捗**: セキュリティコア 95% 完成、UI 統合 20%（2026-04-15 監査確認）

### 6.1 WebAuthn 登録フロー (IdentityPage 統合)
- [x] 6.1.1 `src/lib/webauthn.ts` を新規作成 — credential 生成・assertion 処理 ✅ 2026-04-15 実装確認
- [ ] 6.1.2 IdentityPage に「生体認証をセットアップ」ウィザード追加 ⚠️ UI 統合待ち
- [x] 6.1.3 初回登録: credential.id を localStorage に保存 ✅ credential ID は保存。**TODO**: public key 抽出ロジック (webauthn.ts:139-140)
- [ ] 6.1.4 生体認証有効化時に「✓ 生体認証で保護されています」バッジ表示 ⚠️ UI 統合待ち
- [ ] 6.1.5 WebAuthn 非対応環境での graceful fallback (PIN オプション) ⚠️ PIN オプションは実装だが、UI ページ統合待ち

### 6.2 生体認証連動型キーラッピング (Wrapped Key Storage)
- [x] 6.2.1 `src/lib/crypto.ts` に `wrapMasterKey()` / `unwrapMasterKey()` 関数追加 ✅ 完全実装 (crypto.ts:175-239)
- [x] 6.2.2 WebAuthn assertion 署名から wrapping key を導出 ✅ assertion signature ベース実装（deriveWrappingKey via HMAC）
- [x] 6.2.3 マスターキーを二重暗号化して localStorage 保存（`encryption_key_wrapped_b64`） ✅ 実装済み (crypto.ts:175-200)
- [x] 6.2.4 PIN fallback: PBKDF2-SHA256 による代替 wrapping key 導出 ✅ 完全実装 (crypto.ts:121-165, 100k iterations)
- [x] 6.2.5 復ecode時: WebAuthn signature → wrapping key → unwrap → master key ロード ✅ 実装済み (crypto.ts:211-239)

### 6.3 認証セッション管理 & 15分タイマー
- [x] 6.3.1 `src/lib/auth-session.ts` を新規作成 — セッション状態機械 (LOCKED/AUTHENTICATING/UNLOCKED) ✅ 完全実装 (auth-session.ts)
- [x] 6.3.2 アプリ起動時: LOCKED 状態で初期化 ✅ initializeSession() 実装 (auth-session.ts:419-423)
- [x] 6.3.3 15分無操作タイマーを実装 (inactivity threshold) ✅ resetInactivityTimer() 実装 (auth-session.ts:162-174)
- [ ] 6.3.4 タイマー UI: 右上に「残り時間」カウンター表示 ⚠️ getRemainingTimeMs() は実装だが UI 統合待ち
- [ ] 6.3.5 Dashboard / IdentityPage に sessionState 監視を統合 ⚠️ **CRITICAL GAP**: 両コンポーネントに session リスナー未統合
- [x] 6.3.6 BroadcastChannel API で同一ブラウザ内の複数タブ間でセッション状態を共有 ✅ 完全実装 (auth-session.ts:237-266)

### 6.4 UI/UX 整合性調整
- [ ] 6.4.1 IdentityPage: 24単語バックアップを「高度なリカバリ設定」セクションに移行 ⚠️ 現在 Profile Hero Card に直接表示。移行待ち
- [ ] 6.4.2 SettingsPage: Emergency Recovery セクションを追加（デフォルト折り畳み） ⚠️ UI 実装待ち
- [ ] 6.4.3 Emergency Recovery に「端末紛失時のみ」説明と Amber/Orange バッジ ⚠️ UI 実装待ち
- [x] 6.4.4 ロック画面コンポーネント実装（FaceID アイコン + 「生体認証で保護されています」テキスト） ✅ 完全実装 (LockScreen.tsx:96-116)
- [ ] 6.4.5 「電話帳に保存」「メールで送る」を「一度きりの保険」トーンに文言変更 ⚠️ IdentityPage コンテンツ修正待ち

### 6.5 検証 & テスト
- [ ] 6.5.1 WebAuthn 対応ブラウザで credential 生成確認 ⚠️ 手動テスト待ち（コード は準備完了）
- [ ] 6.5.2 15分タイマー動作確認 ⚠️ 手動テスト待ち
- [ ] 6.5.3 セッション state の LOCKED → AUTHENTICATING → UNLOCKED 遷移確認 ⚠️ 手動テスト待ち。**page.tsx 統合後**
- [ ] 6.5.4 非WebAuthn環境での PIN fallback 動作確認 ⚠️ 手動テスト待ち
- [ ] 6.5.5 BroadcastChannel で複数タブ間のセッション共有確認 ⚠️ 手動テスト待ち
- [ ] 6.5.6 E2E: スキャン → 保存 → ページリロード → 生体認証 → 一覧表示 ⚠️ **CRITICAL**: page.tsx LockScreen 統合が必須

### 6.6 Non-Biometric Fallback (PIN Protection)
- [x] 6.6.1 `crypto.ts` に `deriveWrappingKeyFromPIN()` 実装 (PBKDF2-SHA256, 100k iterations) ✅ 完全実装 (crypto.ts:121-165)
- [x] 6.6.2 `wrapMasterKey()` / `unwrapMasterKey()` 関数実装 ✅ 完全実装 (crypto.ts:175-239)
- [x] 6.6.3 `auth-session.ts` に PIN 認証フロー追加 ✅ authenticateWithPIN() / registerPIN() 実装 (auth-session.ts:290-377)
- [x] 6.6.4 `LockScreen.tsx` に PIN pad UI 実装 ✅ 完全実装 (LockScreen.tsx:164-221)
- [x] 6.6.5 PIN 入力 → wrapping key 導出 → master key unwrap の動作確認 ✅ ロジック完成。UI 統合テスト待ち

---

### 🔴 **Phase 6 Critical Gap（即座に対処）**

**1. page.tsx への LockScreen 統合が未実装**
   - `getSessionManager().getState()` の監視がない
   - `state === 'LOCKED'` のとき `<LockScreen />` を表示する条件が欠けている
   - WebAuthn / PIN 認証後の `session.setMasterKey()` 呼び出しがない
   - **影響**: ユーザーが起動時にロック画面を見ない、15分タイマーが動作しない

**2. Dashboard / SettingsPage への sessionState リスナー統合が未実装**
   - `session.onStateChange()` コールバック登録がない
   - セッション期限切れ時の自動ロックが UI に反映されない

**3. IdentityPage の UI 配置が設計と異なる**
   - 24単語バックアップが Profile Hero Card に表示されている
   - 設計では「高度なリカバリ設定」セクションに配置される予定

**4. SettingsPage の Emergency Recovery UI が未実装**
   - 暗号化キー再生成ロジックは存在
   - 但し「折り畳み」「Amber/Orange バッジ」「端末紛失時のみの説明」がない

---

## 🟨 Phase 7: Multi-Device Pairing & Realtime Sync (Upcoming)

**目標**: 複数デバイス（スマホ ↔ PC）間でマスターキーを E2EE 共有し、名刺データをリアルタイム同期。デバイス紛失時の復旧フローも整備。

**依存**: Phase 6 完了（セッション管理・鍵保護基盤確立）

### 7.1 Device Pairing UI (QR Handshake)
- [ ] 7.1.1 `src/lib/device-pairing.ts` を新規作成 — Device UUID, metadata 管理
- [ ] 7.1.2 `src/lib/qr-generator.ts` を新規作成 — QR code 生成・解析
- [ ] 7.1.3 `src/components/DevicePairingModal.tsx` 実装 — QR 表示・待機 UI
- [ ] 7.1.4 `src/components/DeviceList.tsx` 実装 — Paired devices 一覧
- [ ] 7.1.5 `SettingsPage.tsx` に Device pairing section 追加
- [ ] 7.1.6 Supabase テーブル作成: `paired_devices` (device_uuid, device_name, public_key_pem, pairedAt)

### 7.2 E2EE Key Transfer (RSA-2048 + AES-256-GCM)
- [ ] 7.2.1 `src/lib/e2ee-keytransfer.ts` を新規作成 — RSA key generation/import
- [ ] 7.2.2 `generateRSAKeyPair()` 実装 (modulusLength: 2048, extractable: false)
- [ ] 7.2.3 Master key transfer protocol 実装 (Device A → Device B)
  - QR scan で Device A の public key 取得
  - Device B: Ephemeral AES-256 session key 生成
  - Device B: Session key を RSA-2048 wrap
  - Device A: RSA unwrap → Master key を AES wrap
  - Device B: AES unwrap → Master key 復号
- [ ] 7.2.4 Transfer success/error handling 実装
- [ ] 7.2.5 Forward secrecy: 毎セッション ephemeral key 新規生成

### 7.3 Realtime Data Sync (Supabase Realtime + LWW)
- [ ] 7.3.1 `src/hooks/useRealtimeSync.ts` を新規作成 — Realtime subscription
- [ ] 7.3.2 Supabase Realtime channel subscribe (`postgres_changes` on business_cards)
- [ ] 7.3.3 LWW (Last Write Wins) conflict resolution logic 実装
  - 同時編集: `max(Device A.updated_at, Device B.updated_at)` の版を採用
  - オフライン編集: 接続復旧時に LWW で自動解決
- [ ] 7.3.4 `Dashboard.tsx` に sync status indicator UI 追加 (右上に「同期中...」)
- [ ] 7.3.5 Local change queue + push cycle 実装 (オフライン対応)
- [ ] 7.3.6 E2E: Device A 編集 → Realtime broadcast → Device B リアルタイム更新

### 7.4 Multi-Device Recovery Flow
- [ ] 7.4.1 デバイス紛失時のシナリオ:
  - 1台以上デバイス残存 → QR ハンドシェイク優先
  - 全デバイス紛失 → 24単語フレーズで master key 復元
- [ ] 7.4.2 Supabase `paired_devices` テーブルでデバイス削除フロー
- [ ] 7.4.3 削除デバイスからの sync を無視するロジック

---

## 🟫 Phase 8: 運用安定化 (Operations Stability)

**目標**: Supabase の無停止化・自動再認証・監視ダッシュボードを構築し、プロダクション環境の長期安定運用を実現。

**依存**: Phase 3.5 完了（Dashboard 一覧表示確定）

### 8.1 Keep-Alive API & Cron 設定 ← **2026-04-14 実装**
- [x] 8.1.1 `/api/cron/keep-alive` エンドポイント実装
  - CRON_SECRET によるリクエスト認証
  - Supabase への軽量クエリ（SELECT / UPDATE）実行
  - JSON レスポンス返却 (`{ status: "success", timestamp: "..." }`)
- [x] 8.1.2 `vercel.json` 作成
  - Cron スケジュール設定（毎日 0:00 UTC）
  - path: `/api/cron/keep-alive`
- [x] 8.1.3 環境変数設定
  - Vercel Console に `CRON_SECRET` を追加
  - SUPABASE_URL / SUPABASE_KEY 既存確認
- [x] 8.1.4 動作確認
  - ローカル環境でのエンドポイント動作テスト
  - Vercel デプロイ後のログ確認

### 8.2 監視・ロギング & アラート (Planned)
- [ ] 8.2.1 Vercel Function Logs 定期確認設定
- [ ] 8.2.2 Keep-Alive 失敗時の通知メカニズム
- [ ] 8.2.3 月次ステータスレポート生成

### 8.3 リカバリ手順書 & 障害対応 (Planned)
- [ ] 8.3.1 Supabase ダウン時の緊急対応ガイド
- [ ] 8.3.2 データバックアップ・復旧手順
- [ ] 8.3.3 環境変数再設定チェックリスト

---

## ⚠️ 実装上の鉄則 (Phoenix Edition + Phase 6-7-8)
- **Zero-Knowledge**: サーバーは credential.id, public key, RSA private key, 認証状態を一切見ない。生体データはクライアント Secure Enclave のみ。
- **端末主権**: WebAuthn / PIN / デバイスペアリング / E2EE ロジックは全てクライアント側。サーバーは暗号化済みデータと wrap 済み鍵のみ受け取る。
- **プライバシー保護**: 
  - navigator.credentials 呼び出しはローカル内のみ
  - RSA private key はメモリのみ（export 不可）
  - QR code は on-the-fly 生成（server 経由なし）
- **生データ送信禁止**: 
  - 暗号化済み wrapped key のみ localStorage 格納
  - マスターキーの平文は JavaScript メモリのみ
  - デバイス UUID / pairing metadata のみサーバーに保存（暗号化不要）
- **カメラ解放**: 撮影完了後すみやかにストリーム停止。
- **セッション分離**: 
  - マスターキーは UNLOCKED 状態のみメモリに存在。LOCKED 時は完全削除。
  - BroadcastChannel API で複数タブ間の状態を共有（ブラウザプロセス内隔離）。
- **E2EE 鍵転送**: RSA-2048 wrap・AES-256-GCM wrap で二層暗号化。毎セッション ephemeral key を新規生成（forward secrecy）。
- **Realtime Sync**: LWW 競合解決で運用効率化。CRDT 不要。

---

## 📝 Phase 6 実装上の TODO 注記（2026-04-15 監査確認）

**webauthn.ts の未完成部分**:
- Line 89-90: `encryption_salt` を Supabase から動的取得（現在は placeholder）
- Line 139-140: Attestation Object パース → public key 抽出ロジック
- Line 205-206: Assertion signature 検証ロジック（stored public key との照合）

**auth-session.ts の設定未実装**:
- Line 171-172: hard refresh vs graceful lock screen の設定オプション
- Line 259-260: 複数タブ unlock の同期化設定（現在は独立モード）

**Page/Component 統合タスク** （2026-04-15 Critical Gap）:
1. `page.tsx`: `getSessionManager()` 監視 + LockScreen 条件表示
2. `Dashboard.tsx`: `session.onStateChange()` リスナー登録
3. `SettingsPage.tsx`: `session.onStateChange()` リスナー登録 + Emergency Recovery UI
4. `IdentityPage.tsx`: 24単語を「高度なリカバリ設定」に再配置

---

## 🟥 Phase 9: 次世代統合フェーズ (CPO 提言 2026-04-17)

**目標**: 階層型 Data Key 構造への移行と「顔認証ファースト」UX の実現。
Phase 6-7 の迷走を清算し、Data Key を中心とした一本化された認証・復元フローを確立する。

**依存**: Phase 6 コア完了（crypto.ts / webauthn.ts / auth-session.ts）

### 9.1 階層型 Vault クラス実装
- [x] `src/lib/vault.ts` 新設 — Level 1/2 による Data Key の Wrap/Unwrap ロジック ✅ 2026-04-17
  - `generateDataKey()` / `exportDataKey()` / `importDataKey()`
  - `wrapDataKey(dataKey, wrappingKey)` / `unwrapDataKey(wrapped, wrappingKey)`
  - `deriveWrappingKeyFromMnemonic(mnemonic)` — Level 2 recovery wrapping key
  - `saveVaultToSupabase()` / `loadVaultFromSupabase()` — user_vault テーブル連携
- [ ] 9.1.2 Supabase に `user_vault` テーブルを作成（SQL は design_doc.md Section 5 参照）
- [ ] 9.1.3 `page.tsx` の `handleWebAuthnAuth` を vault 経由の unwrap に移行
  - 現在は `encryption_key_wrapped_b64` (localStorage) を直参照 → `loadVaultFromSupabase` + フォールバック

### 9.2 顔認証ファースト UI の実装
- [x] `SecuritySetup.tsx` 刷新 — 24単語確認ゲートを廃止 ✅ 2026-04-17
  - 「生体認証を有効にする」ボタン1つでセットアップ完了
  - 登録成功時に `wrapped_data_key_alpha` + `wrapped_data_key_beta` を同時生成
  - Supabase `user_vault` へ保存（localStorage へも alpha を保持）
- [x] `LockScreen.tsx` 原点回帰 — biometric / recovery の2モードに簡略化 ✅ 2026-04-17
  - biometric モード: マウント時に platform 認証を自動起動
  - 失敗時のみ「リカバリフレーズを使用」リンクを表示
  - PIN モードを廃止（authenticatorAttachment: 'platform' 固定に準拠）
- [ ] 9.2.3 SettingsPage に「緊急リカバリ」セクションを追加
  - `localStorage.getItem('recovery_mnemonic_pending')` を読み込んで24単語を表示
  - 「バックアップ済み」ボタンで `mnemonic_backed_up = 'true'` をセット
  - デフォルト折り畳み + Amber/Orange バッジ「端末紛失時のみ使用」

### 9.3 エマージェンシー・リペア導線の構築
- [x] `LockScreen.tsx` の recovery モード: Supabase vault 経由で wrapped_data_key_beta → Data Key 奪還 ✅ 2026-04-17
  - Vault 取得失敗時は mnemonic → Data Key 直接導出にフォールバック（旧設計互換）
- [ ] 9.3.2 SettingsPage「緊急リカバリ」セクション: リカバリフレーズのバックアップ確認 UI
- [ ] 9.3.3 `?mode=recovery` URL パラメータ経由でロック画面を recovery モードで直接起動

### 9.4 ドキュメント更新
- [x] `design_doc.md` Section 2.1 — 階層型 Data Key アーキテクチャに全面リライト ✅ 2026-04-17
- [x] `design_doc.md` Section 2.4 — エマージェンシーリペア導線の更新 ✅ 2026-04-17
- [x] `design_doc.md` Section 5 — user_vault テーブル定義を追加 ✅ 2026-04-17
- [x] `ROADMAP.md` Phase 9 を次世代統合フェーズとして再定義 ✅ 2026-04-17

---
