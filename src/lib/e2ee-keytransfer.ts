/**
 * E2EE Master Key Transfer
 *
 * Phase 7-2: RSA-2048 + AES-256-GCM hybrid encryption
 * Device A → Device B: Master key の安全な転送
 *
 * Zero-Knowledge: RSA private key はメモリのみ（export 不可）
 */

// ─── RSA Key Generation ────────────────────────────────────────────────────

/**
 * RSA-2048 キーペアを生成（Device Pairing 初回時）
 *
 * @returns { publicKey (PEM, Base64), privateKey (CryptoKey, memory only) }
 */
export async function generateRSAKeyPair(): Promise<{
  publicKeyPEM: string;
  privateKey: CryptoKey;
}> {
  // Generate RSA-2048 key pair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    false, // extractable: false (private key は export 不可)
    ['wrapKey', 'unwrapKey'] // usage
  );

  // Export public key to PEM format
  const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  // JWK → PEM conversion (SPKI format)
  // TODO: Use a library like node-rsa or crypto-js for JWK→PEM conversion
  // For now, return a placeholder
  const publicKeyPEM = await exportPublicKeyAsPEM(keyPair.publicKey);

  return {
    publicKeyPEM,
    privateKey: keyPair.privateKey,
  };
}

/**
 * CryptoKey (public) を PEM format でエクスポート
 *
 * @param publicKey CryptoKey
 * @returns PEM string (-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----)
 */
async function exportPublicKeyAsPEM(publicKey: CryptoKey): Promise<string> {
  const spkiBuffer = await crypto.subtle.exportKey('spki', publicKey);
  const spkiArray = Array.from(new Uint8Array(spkiBuffer));
  const binaryString = String.fromCharCode.apply(null, spkiArray as any);
  const base64 = btoa(binaryString);

  // Format as PEM
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
  return pem;
}

/**
 * PEM format の public key を CryptoKey にインポート
 *
 * @param pem PEM-formatted RSA public key
 * @returns CryptoKey for RSA operations
 */
export async function importRSAPublicKeyFromPEM(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and newlines
  const pemClean = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\n/g, '')
    .trim();

  // Convert Base64 to binary
  const spkiBuffer = Uint8Array.from(atob(pemClean), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'spki',
    spkiBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false, // extractable: false (private key is not exported)
    ['wrapKey'] // usage
  );
}

// ─── Session Key Generation ───────────────────────────────────────────────

/**
 * Ephemeral AES-256 session key を生成（毎 pairing session 新規）
 * Forward secrecy のため、毎セッション新しい鍵を使用
 *
 * @returns CryptoKey (AES-256-GCM, extractable for this session)
 */
export async function generateEphemeralSessionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable (このセッション中のみ)
    ['encrypt', 'decrypt']
  );
}

// ─── Master Key Transfer Protocol ─────────────────────────────────────────

/**
 * Device A がマスターキーを Device B へ転送
 *
 * Protocol:
 *   1. Device A: Generate ephemeral session key
 *   2. Device A: RSA-OAEP wrap session key with Device B's public key
 *   3. Device A: AES-256-GCM wrap master key with session key
 *   4. Send { wrappedSessionKey, wrappedMasterKey } to Device B
 *
 * @param masterKeyB64 Base64-encoded master key (from localStorage)
 * @param deviceBPublicKeyPEM RSA-2048 public key of Device B (from QR)
 * @returns { wrappedSessionKey, wrappedMasterKey }
 */
export async function transferMasterKeyToDevice(
  masterKeyB64: string,
  deviceBPublicKeyPEM: string
): Promise<{
  wrappedSessionKey: string;
  wrappedMasterKey: string;
}> {
  // Step 1: Generate ephemeral session key
  const sessionKey = await generateEphemeralSessionKey();

  // Step 2: Import Device B's public key
  const deviceBPublicKey = await importRSAPublicKeyFromPEM(
    deviceBPublicKeyPEM
  );

  // Step 3: Wrap session key with Device B's public key (RSA-OAEP)
  const sessionKeyRaw = await crypto.subtle.exportKey('raw', sessionKey);
  const wrappedSessionKeyBytes = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    deviceBPublicKey,
    sessionKeyRaw
  );

  // Step 4: Wrap master key with session key (AES-256-GCM)
  const masterKeyBytes = Uint8Array.from(
    atob(masterKeyB64),
    (c) => c.charCodeAt(0)
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedMasterKeyBytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    masterKeyBytes
  );

  // Encode to Base64
  const wrappedSessionKey = btoa(
    String.fromCharCode(...new Uint8Array(wrappedSessionKeyBytes))
  );
  const wrappedMasterKeyWithIV =
    btoa(String.fromCharCode(...iv)) +
    ':' +
    btoa(String.fromCharCode(...new Uint8Array(wrappedMasterKeyBytes)));

  return {
    wrappedSessionKey,
    wrappedMasterKey: wrappedMasterKeyWithIV,
  };
}

/**
 * Device B がマスターキーを受け取り・復号
 *
 * Protocol:
 *   1. Device B: RSA-OAEP unwrap session key with own private key
 *   2. Device B: AES-256-GCM unwrap master key with session key
 *   3. Import decrypted master key
 *
 * @param wrappedSessionKey RSA-wrapped session key (Base64)
 * @param wrappedMasterKey AES-wrapped master key (Base64)
 * @param ownPrivateKey RSA private key of Device B (memory only)
 * @returns CryptoKey (master key) or null (failure)
 */
export async function receiveMasterKeyFromDevice(
  wrappedSessionKey: string,
  wrappedMasterKey: string,
  ownPrivateKey: CryptoKey
): Promise<CryptoKey | null> {
  try {
    // Step 1: RSA-OAEP unwrap session key
    const wrappedSessionKeyBytes = Uint8Array.from(
      atob(wrappedSessionKey),
      (c) => c.charCodeAt(0)
    );

    const sessionKeyRaw = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      ownPrivateKey,
      wrappedSessionKeyBytes
    );

    // Import session key
    const sessionKey = await crypto.subtle.importKey(
      'raw',
      sessionKeyRaw,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Step 2: Parse wrapped master key (iv:ciphertext)
    const [ivB64, ciphertextB64] = wrappedMasterKey.split(':');
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(
      atob(ciphertextB64),
      (c) => c.charCodeAt(0)
    );

    // Step 3: AES-256-GCM unwrap master key
    const masterKeyBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      ciphertext
    );

    // Step 4: Import as CryptoKey
    const masterKey = await crypto.subtle.importKey(
      'raw',
      masterKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    return masterKey;
  } catch (error) {
    console.error('Failed to receive master key:', error);
    return null;
  }
}

/**
 * Phase 7-2 実装チェックリスト:
 *
 * [ ] npm install tweetnacl (or use Web Crypto for RSA)
 * [ ] JWK ↔ PEM conversion ライブラリ選定
 * [ ] generateRSAKeyPair() の PEM export 実装
 * [ ] importRSAPublicKeyFromPEM() の PEM parse 実装
 * [ ] transferMasterKeyToDevice() のエンドツーエンドテスト
 * [ ] receiveMasterKeyFromDevice() で正しく復号できるか確認
 * [ ] Forward secrecy: 毎セッション新しい ephemeral key
 * [ ] RSA wrap 失敗時の graceful error handling
 * [ ] Device A (transfer) + Device B (receive) の実機テスト
 */
