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
