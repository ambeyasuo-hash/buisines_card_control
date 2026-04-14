# Phase 6: WebAuthn + PAA Integration — Directory & File Structure

## 📁 Core Implementation Files

### 1. Security Library (`src/lib/`)

#### `src/lib/webauthn.ts` ✅ CREATED
**責務**: WebAuthn credential の生成・管理・assertion 処理

**Main Functions**:
- `isWebAuthnSupported()` — ブラウザ互換性チェック
- `isWebAuthnEnabled()` — 有効化状態確認
- `registerWebAuthnCredential()` — 初回 credential 登録
- `assertWebAuthnCredential()` — ユーザー認証 (signature 生成)
- `clearWebAuthnCredential()` — 設定クリア

**Storage** (localStorage):
```
- 'webauthn_credential_id' → Base64-encoded credential ID
- 'webauthn_public_key_b64' → Base64-encoded public key
- 'webauthn_enabled' → Boolean flag
```

**Dependencies**:
- Web Crypto API (navigator.credentials)
- localStorage

---

#### `src/lib/auth-session.ts` ✅ CREATED
**責務**: セッション状態管理・15分タイマー・メモリ管理

**Singleton: AuthSessionManager**

**State Machine**:
```
LOCKED → [authenticate] → AUTHENTICATING → [success] → UNLOCKED
  ↑                                             ↓
  └─────────────── [15min timeout or logout] ───┘
```

**Main Methods**:
- `getState()` / `isLocked()` / `isUnlocked()`
- `setMasterKey(key: CryptoKey)` — メモリに鍵をロード
- `getMasterKey()` → CryptoKey | null
- `lock()` / `startAuthenticating()` / `onAuthenticationFailed()`
- `recordActivity()` — ユーザー操作トリガー
- `getRemainingTimeMs()` — UI タイマー用
- `onStateChange(listener)` — React state update 用

**Storage** (memory only):
```
- masterKeyInstance: CryptoKey | null
- currentState: SessionState
- inactivityTimerId: NodeJS.Timeout
- lastActivityTime: number
```

**BroadcastChannel Integration**:
- 同一ブラウザ内の複数タブでセッション状態を共有
- 他タブでロック時は自動ロック

---

#### `src/lib/crypto.ts` (ENHANCE)
**新規追加 Functions**:

```typescript
/**
 * WebAuthn assertion signature から wrapping key を導出
 */
function deriveWrappingKeyFromAssertion(
  assertionSignature: ArrayBuffer,
  salt: string
): Promise<CryptoKey>
  └─ HMAC-SHA256(signature + salt) → AES-256 key

/**
 * マスターキーを wrapping key で暗号化
 */
async function wrapMasterKey(
  masterKeyB64: string,
  wrappingKey: CryptoKey
): Promise<string> // "v1:<iv>:<ciphertext>"

/**
 * 暗号化されたマスターキーを wrapping key で復号
 */
async function unwrapMasterKey(
  wrappingKey: CryptoKey
): Promise<CryptoKey>

/**
 * PIN から wrapping key を導出（fallback）
 */
function deriveWrappingKeyFromPIN(
  pin: string,
  salt: string
): CryptoKey
  └─ PBKDF2(pin, salt, 100k iter, SHA-256)
```

**Storage Updates**:
```
OLD: 'encryption_key_b64' → マスターキーの平文 Base64
NEW: 'encryption_key_wrapped_b64' → AES-256-GCM encrypted

OPTIONAL: 'encryption_key_legacy_b64' → Fallback (WebAuthn disabled)
```

---

### 2. UI Components (`src/components/`)

#### `src/components/LockScreen.tsx` ✅ CREATED
**責務**: セッション LOCKED 状態の UI 表示

**Props**:
```typescript
interface LockScreenProps {
  onAuthenticate: () => Promise<boolean>;
  onShowRecovery?: () => void;
  isAuthenticating?: boolean;
  error?: string;
}
```

**Features**:
- 生体認証アイコン（Lock icon + gradient glow animation）
- 「認証」ボタン
- 「リカバリキーで復旧」リンク
- エラーメッセージ表示
- Framer Motion アニメーション

---

#### `src/components/SessionProvider.tsx` (NEW)
**責務**: React Context で auth-session 管理を全体に供給

**Implementation**:
```typescript
export const SessionContext = createContext<AuthSessionManager | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>('LOCKED');

  useEffect(() => {
    const unsubscribe = session.onStateChange(setSessionState);
    return unsubscribe;
  }, []);

  return (
    <SessionContext.Provider value={getSessionManager()}>
      {sessionState === 'LOCKED' && <LockScreen ... />}
      {children}
    </SessionContext.Provider>
  );
}

export function useAuthSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useAuthSession must be inside SessionProvider');
  return ctx;
}
```

---

#### `src/components/IdentityPage.tsx` (ENHANCE)
**Changes**:
- `src/lib/webauthn.ts` の `registerWebAuthnCredential()` を呼び出し
- 「生体認証をセットアップ」ウィザード UI 追加
- セットアップ成功時に「✓ 生体認証で保護されています」バッジ表示

**New Sections**:
```tsx
// セットアップウィザード
<WebAuthnSetupWizard
  onComplete={() => { /* バッジ更新 */ }}
  onError={(msg) => { /* エラー表示 */ }}
/>

// 24単語は「Emergency Recovery」セクションに移行
<div className="mt-8 border-t border-white/10 pt-6">
  <details>
    <summary>🔴 緊急リカバリ (Emergency Recovery)</summary>
    <div className="mt-4">
      <p className="text-xs text-muted-foreground mb-4">
        端末紛失時のみ必要です。日常利用には生体認証をご使用ください。
      </p>
      {/* 24単語表示 ... */}
    </div>
  </details>
</div>
```

---

#### `src/components/SettingsPage.tsx` (ENHANCE)
**Changes**:
- 「生体認証の管理」セクション追加
- 「🔴 緊急リカバリ」セクションを追加（デフォルト折り畳み）
- WebAuthn enabled flag を表示・制御

**New Sections**:
```tsx
// Biometric Auth Management
<section className="border-t border-white/10 pt-6">
  <h3 className="text-lg font-semibold mb-4">生体認証の管理</h3>
  {isWebAuthnEnabled ? (
    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
      <p className="text-sm text-emerald-300 mb-3">
        ✓ 生体認証で保護されています
      </p>
      <button onClick={() => clearWebAuthnCredential()}>
        生体認証をリセット
      </button>
    </div>
  ) : (
    <WebAuthnSetupWizard ... />
  )}
</section>

// Emergency Recovery
<section className="border-t border-white/10 pt-6">
  <details>
    <summary className="text-sm font-medium mb-4">
      🔴 緊急リカバリ (Emergency Recovery)
    </summary>
    {/* 24単語表示 */}
  </details>
</section>
```

---

#### `src/components/Dashboard.tsx` (ENHANCE)
**Changes**:
- `useAuthSession()` hook で session state を監視
- state === 'LOCKED' なら LockScreen override
- タイマー UI（右上）を追加（UNLOCKED 時）

**Integration**:
```tsx
const session = useAuthSession();

if (session.isLocked()) {
  return <LockScreen onAuthenticate={handleWebAuthnAuth} />;
}

return (
  <>
    {/* Right-top timer */}
    {session.isUnlocked() && (
      <div className="absolute top-4 right-4 text-xs text-muted-foreground">
        {formatRemainingTime(session.getRemainingTimeMs())}
      </div>
    )}
    
    {/* Dashboard content */}
    ...
  </>
);
```

---

#### `src/app/layout.tsx` (ENHANCE)
**Changes**:
- `<SessionProvider>` で全体をwrap

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  App Launch (layout.tsx)                                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
        ┌────────────────────────────────┐
        │  SessionProvider initialized   │
        │  State: LOCKED                 │
        └────────────┬───────────────────┘
                     │
                     ↓
    ┌────────────────────────────────────┐
    │  LockScreen rendered               │
    │  "生体認証で保護されています"       │
    │  [認証ボタン]                      │
    └────────────┬───────────────────────┘
                 │
                 ├─→ [認証ボタン tap]
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  webauthn.ts:assertCredential()    │
    │  FaceID / 指紋プロンプト表示       │
    └────────────┬───────────────────────┘
                 │
                 ├─→ [FaceID成功]
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  crypto.ts:deriveWrappingKey()     │
    │  Assertion sig + salt → key        │
    └────────────┬───────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  crypto.ts:unwrapMasterKey()       │
    │  wrapped key → plaintext key       │
    └────────────┬───────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  auth-session.ts:setMasterKey()    │
    │  State: UNLOCKED                   │
    │  Timer: 15min countdown            │
    └────────────┬───────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  Dashboard rendered                │
    │  Business cards decrypted & shown  │
    │  Timer UI: 14:59, 14:58, ...       │
    └────────────┬───────────────────────┘
                 │
        [ユーザー操作 or 15min timeout]
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  auth-session.ts:lock()            │
    │  State: LOCKED                     │
    │  Master key cleared                │
    └────────────┬───────────────────────┘
                 │
                 └─→ (back to LockScreen)
```

---

## 🔒 Zero-Knowledge Constraint Compliance

| Component | Data | Server Sees? | Secure? |
|-----------|------|---|---|
| WebAuthn credential ID | Stored in localStorage | ❌ No | ✅ Client-only |
| WebAuthn public key | Stored in localStorage | ❌ No | ✅ Client-only |
| WebAuthn assertion sig | Transient (memory) | ❌ No | ✅ Local derive only |
| Wrapped master key | `encryption_key_wrapped_b64` | ❌ No | ✅ Requires unwrap |
| Master key (plaintext) | CryptoKey (memory) | ❌ No | ✅ Memory only |
| Biometric data (FaceID/指紋) | Secure Enclave/TEE | ❌ No | ✅ Platform-protected |
| Session state (LOCKED/UNLOCKED) | BroadcastChannel (same browser) | ❌ No | ✅ Client-only |

---

## 🧪 Implementation Checklist

### Phase 6-1: WebAuthn Registration
- [ ] `webauthn.ts` 完成（credential.id + public key extraction）
- [ ] `IdentityPage.tsx` に WebAuthn setup wizard 追加
- [ ] 「生体認証で保護されています」バッジ表示
- [ ] 複数ブラウザでの動作確認 (Safari 16+, Chrome 67+)

### Phase 6-2: Key Wrapping
- [ ] `crypto.ts` に wrap/unwrap functions 追加
- [ ] assertion signature から wrapping key 導出ロジック
- [ ] localStorage に `encryption_key_wrapped_b64` 保存
- [ ] PIN fallback (PBKDF2) テスト

### Phase 6-3: Session Management
- [ ] `auth-session.ts` 完成
- [ ] `SessionProvider` & React Context 統合
- [ ] `LockScreen.tsx` 実装
- [ ] 15分タイマー UI 実装
- [ ] BroadcastChannel 複数タブ共有テスト

### Phase 6-4: UI/UX Integration
- [ ] Dashboard に session state 監視を追加
- [ ] SettingsPage に Emergency Recovery セクション追加
- [ ] 「電話帳に保存」「メール送信」を「一度きりの保険」トーンに変更
- [ ] IdentityPage リカバリセクションの表示順変更

### Phase 6-5: Testing & Verification
- [ ] WebAuthn 対応端末での生体認証テスト
- [ ] WebAuthn 非対応環境での PIN fallback テスト
- [ ] 15分タイマー遅延テスト（時間をスキップ）
- [ ] ページリロード → ロック状態確認
- [ ] 複数タブでの状態同期テスト

---

## 🚀 Deployment Notes

**Breaking Changes**: None
- Legacy `encryption_key_b64` はオプショナル（fallback対応）
- WebAuthn disabled の場合は既存フローと同じ

**Performance Impact**: Minimal
- WebAuthn は OS-native（重い処理ではない）
- Session timer は passive event listeners のみ

**Browser Support**:
- ✅ iOS 16+ (Face ID / Touch ID)
- ✅ Android 9+ (Biometric)
- ✅ macOS 13+ (Touch ID)
- ✅ Windows Hello
- ⚠️ Legacy browsers: graceful fallback (PIN)

---

**Status**: 📋 Structure Ready for Implementation
**Next**: Code integration & testing
