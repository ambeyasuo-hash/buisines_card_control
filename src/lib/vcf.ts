/**
 * VCF (vCard 3.0) — 暗号化キーの電話帳バックアップ
 *
 * Zero-Knowledge Key Recovery:
 *   AES-256-GCM 暗号化キーを vCard の NOTE フィールドに埋め込み、
 *   端末の連絡先アプリにバックアップとして保存する。
 *
 *   - Web Share API が使用可能なモバイルでは「連絡先に追加」ダイアログを表示
 *   - 非対応環境では .vcf ファイルをダウンロード
 */

/**
 * 暗号化キーを含む vCard 文字列を生成
 */
export function generateKeyVCF(keyB64: string): string {
  // ISO 8601 → vCard REV 形式 (例: 20260414T063500Z)
  const ts = new Date()
    .toISOString()
    .replace(/[-:.]/g, '')
    .replace('T', 'T')
    .slice(0, 15) + 'Z';

  // NOTE フィールド内の改行は vCard 仕様に従い \n でエスケープ
  const noteLines = [
    '【ambe 名刺管理 - 暗号化キーバックアップ】',
    '',
    'この連絡先には名刺データの暗号化キーが含まれています。',
    '絶対に削除しないでください。',
    '',
    `Key: ${keyB64}`,
    '',
    `生成日時: ${ts}`,
  ].join('\\n');

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:ambe 名刺管理キー',
    'N:名刺管理キー;ambe;;;',
    'ORG:ambe Business Card App',
    'TITLE:暗号化キーバックアップ',
    `NOTE:${noteLines}`,
    'CATEGORIES:ambe-app,backup',
    `REV:${ts}`,
    'END:VCARD',
  ].join('\r\n');
}

/**
 * 暗号化キーを vCard として共有または保存
 *
 * - モバイル: Web Share API → 「連絡先に追加」ダイアログ
 * - デスクトップ: .vcf ファイルをダウンロード
 */
export async function shareOrDownloadVCF(keyB64: string): Promise<void> {
  const vcfContent = generateKeyVCF(keyB64);
  const blob       = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const filename   = 'ambe-backup-key.vcf';

  // ① Web Share API — モバイルで「連絡先に追加」ダイアログを表示
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([blob], filename, { type: 'text/vcard' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'ambe 名刺管理 — 暗号化キー',
          text:  '名刺データの暗号化キーをバックアップします。この連絡先を連絡先アプリで保存してください。',
          files: [file],
        });
        return;
      }
    } catch (e) {
      // AbortError (ユーザーキャンセル) 以外はフォールバックへ
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }

  // ② フォールバック: .vcf ファイルをダウンロード
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
