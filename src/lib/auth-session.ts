/**
 * Session Management & 15-Min Inactivity Timer
 *
 * Phase 6: Biometric Security & PAA Integration
 *
 * 責務:
 *   - セッション状態管理 (LOCKED / AUTHENTICATING / UNLOCKED)
 *   - 15分無操作タイマー
 *   - マスターキーのメモリ内管理
 *   - 複数タブ間のセッション共有 (BroadcastChannel API)
 *
 * Zero-Knowledge 原則:
 *   - マスターキー（CryptoKey オブジェクト）は memory のみ。localStorage に保存しない。
 *   - サーバーにセッション状態を報告しない。
 *   - ページ遷移 / リロード / タブ閉鎖時は自動クリア。
 */

import { deriveWrappingKeyFromPIN, unwrapMasterKey } from './crypto';

// ─── Types ────────────────────────────────────────────────────────────────

export type SessionState = 'LOCKED' | 'AUTHENTICATING' | 'UNLOCKED';

interface SessionConfig {
  inactivityThresholdMs: number; // デフォルト: 15分 = 900000ms
  broadcastChannelName: string;
}

interface SessionEvent {
  type: 'lock' | 'unlock' | 'authenticate-start' | 'authenticate-fail';
  timestamp: number;
  state?: SessionState;
}

// ─── Singleton Session Manager ────────────────────────────────────────────

class AuthSessionManager {
  private currentState: SessionState = 'LOCKED';
  private masterKeyInstance: CryptoKey | null = null;
  private inactivityTimerId: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private broadcastChannel: BroadcastChannel | null = null;
  private config: SessionConfig;
  private listeners: Set<(state: SessionState) => void> = new Set();
  private skipLockFlag: boolean = false; // One-time bypass flag for setup flow

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = {
      inactivityThresholdMs: 15 * 60 * 1000, // 15 min
      broadcastChannelName: 'ambe-auth-session',
      ...config,
    };

    this.initializeBroadcastChannel();
    this.setupInactivityListener();
    this.setupPageUnloadListener();
  }

  // ─── State Accessors ──────────────────────────────────────────────────

  public getState(): SessionState {
    return this.currentState;
  }

  public isUnlocked(): boolean {
    return this.currentState === 'UNLOCKED';
  }

  public isLocked(): boolean {
    return this.currentState === 'LOCKED';
  }

  /**
   * Lock screen を一回だけバイパス（初期セットアップフロー用）
   * SettingsPage へ遷移時に呼び出し、設定画面で認証を求めない
   */
  public skipLockOnce(): void {
    this.skipLockFlag = true;
  }

  /**
   * Skip lock フラグをチェックして消費
   */
  public consumeSkipLockFlag(): boolean {
    const flag = this.skipLockFlag;
    this.skipLockFlag = false; // One-time use
    return flag;
  }

  // ─── Master Key Management ────────────────────────────────────────────

  /**
   * マスターキーを memory に設定（WebAuthn assertion 後）
   */
  public setMasterKey(key: CryptoKey): void {
    this.masterKeyInstance = key;
    this.setState('UNLOCKED');
    this.resetInactivityTimer();
  }

  /**
   * マスターキーを取得（暗号化・復号化処理用）
   */
  public getMasterKey(): CryptoKey | null {
    if (!this.isUnlocked()) {
      console.warn('[AuthSession] Cannot access master key in LOCKED state');
      return null;
    }
    return this.masterKeyInstance;
  }

  /**
   * マスターキーを memory から削除（ロック時）
   */
  private clearMasterKey(): void {
    this.masterKeyInstance = null;
  }

  // ─── Session State Management ─────────────────────────────────────────

  /**
   * セッション状態を遷移させる
   */
  private setState(newState: SessionState): void {
    if (this.currentState === newState) return;

    const oldState = this.currentState;
    this.currentState = newState;

    console.log(`[AuthSession] State transition: ${oldState} → ${newState}`);

    if (newState === 'UNLOCKED') {
      this.resetInactivityTimer();
    } else if (newState === 'LOCKED') {
      this.clearInactivityTimer();
      this.clearMasterKey();
    }

    // BroadcastChannel で同一ブラウザ内の他タブに通知
    this.broadcastSessionEvent({
      type: newState === 'LOCKED' ? 'lock' : 'unlock',
      timestamp: Date.now(),
      state: newState,
    });

    // リスナーに通知
    this.listeners.forEach((listener) => listener(newState));
  }

  /**
   * ロック状態に遷移
   */
  public lock(): void {
    this.setState('LOCKED');
  }

  /**
   * 認証中状態に遷移（WebAuthn プロンプト表示時）
   */
  public startAuthenticating(): void {
    this.setState('AUTHENTICATING');
  }

  /**
   * 認証失敗時（ロック状態に戻す）
   */
  public onAuthenticationFailed(): void {
    this.setState('LOCKED');
    this.broadcastSessionEvent({
      type: 'authenticate-fail',
      timestamp: Date.now(),
    });
  }

  // ─── Inactivity Timer ─────────────────────────────────────────────────

  /**
   * 15分タイマーをリセット（ユーザー操作時）
   */
  private resetInactivityTimer(): void {
    this.clearInactivityTimer();

    if (!this.isUnlocked()) return;

    this.inactivityTimerId = setTimeout(() => {
      console.log('[AuthSession] 15-min inactivity timeout triggered');
      this.setState('LOCKED');
      // Hard refresh してメモリをクリア
      // TODO: 設定で hard refresh か graceful lock screen を選択可能にする
      // navigator.reload();
    }, this.config.inactivityThresholdMs);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimerId) {
      clearTimeout(this.inactivityTimerId);
      this.inactivityTimerId = null;
    }
  }

  /**
   * 残り時間を取得（UI タイマー表示用）
   */
  public getRemainingTimeMs(): number {
    if (!this.isUnlocked() || !this.inactivityTimerId) return 0;
    const elapsed = Date.now() - this.lastActivityTime;
    return Math.max(0, this.config.inactivityThresholdMs - elapsed);
  }

  // ─── Activity Tracking ────────────────────────────────────────────────

  /**
   * ユーザーアクティビティを記録（クリック、キープレス等）
   */
  public recordActivity(): void {
    this.lastActivityTime = Date.now();
    if (this.isUnlocked()) {
      this.resetInactivityTimer();
    }
  }

  /**
   * Global activity listener をセットアップ
   */
  private setupInactivityListener(): void {
    if (typeof window === 'undefined') return;

    const events = ['click', 'keypress', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => this.recordActivity();

    events.forEach((event) => {
      window.addEventListener(event, handler, { passive: true });
    });
  }

  // ─── Page Unload Handler ──────────────────────────────────────────────

  /**
   * ページ遷移時にマスターキーをクリア
   */
  private setupPageUnloadListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('unload', () => {
      this.clearMasterKey();
      this.clearInactivityTimer();
    });

    window.addEventListener('beforeunload', () => {
      this.clearMasterKey();
      this.clearInactivityTimer();
    });
  }

  // ─── BroadcastChannel Integration ─────────────────────────────────────

  /**
   * BroadcastChannel で他タブと状態を共有
   */
  private initializeBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[AuthSession] BroadcastChannel not supported');
      return;
    }

    try {
      this.broadcastChannel = new BroadcastChannel(this.config.broadcastChannelName);

      this.broadcastChannel.onmessage = (event) => {
        const message = event.data as SessionEvent;
        console.log('[AuthSession] BroadcastChannel message:', message);

        if (message.type === 'lock' && message.state === 'LOCKED') {
          // 他タブがロックしたら、このタブもロック
          this.setState('LOCKED');
        } else if (message.type === 'unlock' && message.state === 'UNLOCKED') {
          // 他タブがアンロック → このタブは状態保持（セキュリティのため independent）
          // TODO: 設定で「同期」か「独立」を選択可能にする
        }
      };
    } catch (error) {
      console.error('[AuthSession] BroadcastChannel init error:', error);
    }
  }

  private broadcastSessionEvent(event: SessionEvent): void {
    if (!this.broadcastChannel) return;

    try {
      this.broadcastChannel.postMessage(event);
    } catch (error) {
      console.error('[AuthSession] BroadcastChannel post error:', error);
    }
  }

  // ─── PIN Authentication (Phase 6-6) ───────────────────────────────────

  /**
   * PIN による認証フロー（WebAuthn 非対応環境向け）
   *
   * 流れ:
   *   1. ユーザーが PIN を入力
   *   2. PBKDF2 で wrapping key を導出
   *   3. wrapped master key を unwrap
   *   4. Success: setMasterKey() でセッション UNLOCKED
   *   5. Failure: エラーメッセージ表示
   */
  public async authenticateWithPIN(pin: string): Promise<boolean> {
    try {
      this.setState('AUTHENTICATING');

      // Step 1: Get encryption salt from localStorage
      const encryptionSalt = localStorage.getItem('encryption_salt');
      if (!encryptionSalt) {
        throw new Error('Encryption salt not found. Please set up your device first.');
      }

      // Step 2: Derive wrapping key from PIN
      const wrappingKey = await deriveWrappingKeyFromPIN(pin, encryptionSalt);

      // Step 3: Retrieve wrapped master key from localStorage
      const wrappedKeyB64 = localStorage.getItem('encryption_key_wrapped_b64');
      if (!wrappedKeyB64) {
        throw new Error('Wrapped key not found. Please register a PIN first.');
      }

      // Step 4: Unwrap master key
      const masterKey = await unwrapMasterKey(wrappedKeyB64, wrappingKey);

      // Step 5: Success - set master key and unlock
      this.setMasterKey(masterKey);
      console.log('[AuthSession] PIN authentication successful');
      return true;
    } catch (error) {
      console.error('[AuthSession] PIN authentication failed:', error);
      this.setState('LOCKED');
      return false;
    }
  }

  /**
   * PIN 登録フロー（初回セットアップ時）
   *
   * 流れ:
   *   1. ユーザーが PIN を設定
   *   2. Validate PIN strength
   *   3. PBKDF2 で wrapping key を導出
   *   4. 現在のマスターキーを wrapping key で暗号化
   *   5. wrapped key を localStorage に保存
   */
  public async registerPIN(pin: string): Promise<boolean> {
    try {
      // Import crypto functions
      const { validatePINStrength, wrapMasterKey, deriveWrappingKeyFromPIN } =
        await import('./crypto');

      // Step 1: Validate PIN strength
      const validation = validatePINStrength(pin);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Step 2: Get current master key from memory
      const masterKey = this.masterKeyInstance;
      if (!masterKey) {
        throw new Error('Master key not available in memory');
      }

      // Step 3: Export master key to Base64
      const { exportKeyAsBase64 } = await import('./crypto');
      const masterKeyB64 = await exportKeyAsBase64(masterKey);

      // Step 4: Get encryption salt
      const encryptionSalt = localStorage.getItem('encryption_salt');
      if (!encryptionSalt) {
        throw new Error('Encryption salt not found');
      }

      // Step 5: Derive wrapping key from PIN
      const wrappingKey = await deriveWrappingKeyFromPIN(pin, encryptionSalt);

      // Step 6: Wrap master key
      const wrappedKeyB64 = await wrapMasterKey(masterKeyB64, wrappingKey);

      // Step 7: Save wrapped key to localStorage
      localStorage.setItem('encryption_key_wrapped_b64', wrappedKeyB64);
      localStorage.setItem('pin_enabled', 'true');

      console.log('[AuthSession] PIN registered successfully');
      return true;
    } catch (error) {
      console.error('[AuthSession] PIN registration failed:', error);
      return false;
    }
  }

  /**
   * PIN が登録されているか確認
   */
  public isPINEnabled(): boolean {
    return localStorage.getItem('pin_enabled') === 'true';
  }

  // ─── Event Listeners ──────────────────────────────────────────────────

  /**
   * セッション状態変化時のリスナーを登録
   */
  public onStateChange(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────

  public destroy(): void {
    this.clearInactivityTimer();
    this.clearMasterKey();
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.listeners.clear();
  }
}

// ─── Singleton Instance ────────────────────────────────────────────────────

let sessionManagerInstance: AuthSessionManager | null = null;

export function getSessionManager(): AuthSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new AuthSessionManager();
  }
  return sessionManagerInstance;
}

export function initializeSession(): void {
  const manager = getSessionManager();
  manager.lock();
  console.log('[AuthSession] Initialized with LOCKED state');
}

// ─── Exports for convenience ──────────────────────────────────────────────

export const session = {
  getState: () => getSessionManager().getState(),
  isUnlocked: () => getSessionManager().isUnlocked(),
  isLocked: () => getSessionManager().isLocked(),
  lock: () => getSessionManager().lock(),
  setMasterKey: (key: CryptoKey) => getSessionManager().setMasterKey(key),
  getMasterKey: () => getSessionManager().getMasterKey(),
  recordActivity: () => getSessionManager().recordActivity(),
  getRemainingTimeMs: () => getSessionManager().getRemainingTimeMs(),
  onStateChange: (listener: (state: SessionState) => void) =>
    getSessionManager().onStateChange(listener),
  // Phase 6-6: PIN Authentication
  authenticateWithPIN: (pin: string) => getSessionManager().authenticateWithPIN(pin),
  registerPIN: (pin: string) => getSessionManager().registerPIN(pin),
  isPINEnabled: () => getSessionManager().isPINEnabled(),
  // Setup flow bypass
  skipLockOnce: () => getSessionManager().skipLockOnce(),
  consumeSkipLockFlag: () => getSessionManager().consumeSkipLockFlag(),
};

/**
 * Phase 6 実装チェックリスト:
 *
 * [ ] React context で session manager を wrap （SessionProvider）
 * [ ] Dashboard / IdentityPage で session state を監視
 * [ ] ロック画面コンポーネントの実装
 * [ ] タイマー UI（残り時間カウンター）の実装
 * [ ] Hard refresh vs graceful lock の設定オプション
 * [ ] 複数タブ間の状態共有テスト
 * [ ] メモリリーク（listener unregister）の確認
 */
