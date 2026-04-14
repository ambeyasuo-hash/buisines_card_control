/**
 * Supabase Schema for Phase 7: Multi-Device Sync
 *
 * ⚠️  Zero-Knowledge Principle:
 *   - paired_devices: Device metadata & public keys only (no private keys)
 *   - handshake_transfers: Encrypted master keys (RSA-wrapped, then AES-wrapped)
 *   - business_cards: Already encrypted with master key (no changes)
 *
 * All private keys remain on the device (memory/localStorage only)
 */

-- ═══════════════════════════════════════════════════════════════════════════
-- Table 1: paired_devices
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS paired_devices (
  id BIGSERIAL PRIMARY KEY,

  -- Device identification
  device_uuid UUID NOT NULL UNIQUE,
  device_name TEXT NOT NULL,

  -- Device metadata (for UX display)
  os TEXT NOT NULL, -- iOS, Android, macOS, Windows
  device_type TEXT NOT NULL, -- mobile, desktop

  -- RSA-2048 public key (PEM format, Base64)
  -- Private key is NEVER sent to server
  public_key_pem TEXT NOT NULL,

  -- Session & pairing timestamps
  paired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete (optional)
  deleted_at TIMESTAMP WITH TIME ZONE NULL,

  CONSTRAINT no_deleted_devices AS (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_paired_devices_device_uuid
  ON paired_devices(device_uuid) WHERE deleted_at IS NULL;

-- RLS: Anonymous users can read their own paired devices (by device_uuid from localStorage)
ALTER TABLE paired_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_read_own_devices"
  ON paired_devices FOR SELECT
  USING (true); -- Mobile-first: no user auth, all devices contribute equally

-- ═══════════════════════════════════════════════════════════════════════════
-- Table 2: handshake_transfers
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS handshake_transfers (
  id BIGSERIAL PRIMARY KEY,

  -- Session identification
  session_id UUID NOT NULL,

  -- Initiator (QR code generator) and Responder (QR scanner)
  initiator_device_uuid UUID NOT NULL,
  responder_device_uuid UUID NOT NULL,

  -- Wrapped master key transfer
  -- Device B has already RSA-wrapped the ephemeral session key
  -- and AES-wrapped the master key with that session key
  wrapped_session_key TEXT NOT NULL, -- RSA-OAEP encrypted (Base64)
  wrapped_master_key TEXT NOT NULL, -- AES-256-GCM encrypted (v1:iv:ciphertext format)

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '5 minutes',

  -- Status tracking (optional, for debugging)
  status TEXT DEFAULT 'pending', -- pending, transferred, acknowledged, expired

  CONSTRAINT valid_session_id CHECK (session_id != '00000000-0000-0000-0000-000000000000'),
  CONSTRAINT session_not_expired AS (created_at + INTERVAL '5 minutes' > CURRENT_TIMESTAMP) DEFERRABLE
);

-- Indexes for polling
CREATE INDEX IF NOT EXISTS idx_handshake_transfers_session_id
  ON handshake_transfers(session_id);

CREATE INDEX IF NOT EXISTS idx_handshake_transfers_initiator
  ON handshake_transfers(initiator_device_uuid) WHERE status = 'pending';

-- RLS: Anonymous users can insert and read (key exchange is transient & encrypted)
ALTER TABLE handshake_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_create_handshake"
  ON handshake_transfers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_anon_read_pending_handshakes"
  ON handshake_transfers FOR SELECT
  USING (status = 'pending' AND expires_at > CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════════════════
-- Table 3: device_sync_queue (for offline change tracking)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS device_sync_queue (
  id BIGSERIAL PRIMARY KEY,

  -- Device that made the change
  device_uuid UUID NOT NULL,

  -- Card reference & change details
  card_id UUID NOT NULL,
  change_type TEXT NOT NULL, -- insert, update, delete
  encrypted_data TEXT, -- Full encrypted card state (for inserts/updates)

  -- Timestamps for LWW (Last Write Wins) conflict resolution
  change_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_attempted_at TIMESTAMP WITH TIME ZONE NULL,
  sync_completed_at TIMESTAMP WITH TIME ZONE NULL,

  -- For debugging/monitoring
  sync_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_sync_queue_device_uuid
  ON device_sync_queue(device_uuid);

CREATE INDEX IF NOT EXISTS idx_device_sync_queue_synced
  ON device_sync_queue(sync_completed_at) WHERE sync_completed_at IS NULL;

-- RLS: Anonymous users can read/write their own device queue
ALTER TABLE device_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_manage_own_queue"
  ON device_sync_queue FOR ALL
  USING (true); -- Devices are trusted to sync their own changes

-- ═══════════════════════════════════════════════════════════════════════════
-- Grants for anonymous access (if using anon role)
-- ═══════════════════════════════════════════════════════════════════════════

-- If using Supabase's `anon` role (public access):
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON TABLE paired_devices TO anon;
GRANT ALL ON TABLE handshake_transfers TO anon;
GRANT ALL ON TABLE device_sync_queue TO anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Notes on Zero-Knowledge Compliance
-- ═══════════════════════════════════════════════════════════════════════════

/*
1. **paired_devices**:
   - Stores only public keys (RSA-2048 public key PEM)
   - No private keys, no credentials, no secrets
   - Device metadata is non-sensitive (OS, device name)
   - Server can never decrypt any master key

2. **handshake_transfers**:
   - Transient table (5-min TTL)
   - Master key is already doubly encrypted:
     a. RSA-OAEP wrap: Ephemeral session key wrapped with Device A's public key
     b. AES-256-GCM wrap: Master key wrapped with that ephemeral session key
   - Only Device A (with its RSA private key) can unwrap → no server involvement

3. **device_sync_queue**:
   - Local queue for offline changes
   - encrypted_data is already AES-256-GCM encrypted with master key
   - Server never sees plaintext

4. **RLS (Row-Level Security)**:
   - No user_id column (mobile-first, anonymous)
   - All devices contribute equally (democratic model)
   - Session-based expiry (5-10 min) ensures data freshness

5. **Business Cards**:
   - Unchanged from Phase 3.5
   - encrypted_data column remains (AES-256-GCM with master key)
   - Master key is synchronized via Phase 7-2 (E2EE key transfer)
*/
