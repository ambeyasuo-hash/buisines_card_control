// (c) 2026 ambe / Business_Card_Folder

export type PrefetchedLocation = {
  lat: number;
  lng: number;
  accuracyMeters: number;
  timestamp: number;
};

let inflight: Promise<PrefetchedLocation | null> | null = null;

export function prefetchGeolocation(): Promise<PrefetchedLocation | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  if (inflight) return inflight;

  inflight = new Promise<PrefetchedLocation | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }).finally(() => {
    // キャッシュは保持（次回以降は呼び出し側で必要に応じてリセット）
  });

  return inflight;
}

export function resetPrefetchedGeolocation(): void {
  inflight = null;
}

