/**
 * Geolocation utilities — 位置情報取得
 * ブラウザの Geolocation API を使用して緯度経度を取得
 */

export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
}

/**
 * ブラウザの位置情報を取得
 * @returns 緯度経度 or エラー情報
 */
export function getLocation(): Promise<LocationCoords | LocationError> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        code: 0,
        message: 'Geolocation is not supported by this browser',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let message = 'Unknown error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = '位置情報へのアクセス許可が拒否されました';
            break;
          case error.POSITION_UNAVAILABLE:
            message = '位置情報を取得できません（GPS信号なし）';
            break;
          case error.TIMEOUT:
            message = '位置情報取得がタイムアウトしました';
            break;
        }
        resolve({ code: error.code, message });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

/**
 * 逆ジオコーディング：座標から住所を取得
 * OpenStreetMap Nominatim API を使用
 * オフライン・API制限時は gracefully フェイルする
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // OpenStreetMap Nominatim — 無料、API キー不要
    // 言語を日本語に設定し、住所フォーマットを指定
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&lang=ja`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (!response.ok) {
      console.warn(`Nominatim API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      address?: Record<string, string>;
      error?: string;
    };

    if (data.error) {
      console.warn('Nominatim API error:', data.error);
      return null;
    }

    if (!data.address) {
      console.warn('No address data returned from Nominatim');
      return null;
    }

    const addr = data.address;

    // 日本の住所フォーマット：都道府県 + 市区町村 + 町名
    // Nominatim の address オブジェクトから必要な要素を抽出
    const prefecture = addr.state || addr.province || '';
    const city = addr.city || addr.town || addr.village || '';
    const suburb = addr.suburb || addr.district || '';

    const parts = [prefecture, city, suburb].filter(p => p && p.trim());
    if (parts.length === 0) {
      // フォールバック：緯度経度を返す
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    return parts.join('');
  } catch (error) {
    // ネットワークエラー、CORS エラー等 → gracefully フェイル
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * 座標から都道府県名を推定（簡易版）
 * 実装注：実際には Reverse Geocoding API が必要
 * ここではプレイスホルダー実装
 */
export function estimatePrefecture(lat: number, lng: number): string {
  // 簡易的な座標→都道府県マップ（実装の都合上、主要都市のみ）
  if (lat >= 35.6 && lat <= 35.7 && lng >= 139.7 && lng <= 139.8) {
    return '東京都';
  }
  if (lat >= 34.6 && lat <= 34.7 && lng >= 135.4 && lng <= 135.6) {
    return '京都府';
  }
  if (lat >= 34.6 && lat <= 34.7 && lng >= 135.5 && lng <= 135.6) {
    return '大阪府';
  }
  return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}
