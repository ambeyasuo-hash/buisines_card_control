// (c) 2026 ambe / Business_Card_Folder
// Reverse geocoding via OpenStreetMap Nominatim.
// Privacy: only GPS coordinates are transmitted; no personally identifiable
// data is included.  Nominatim usage policy: ≤1 req/sec — this app fires
// at most once per card save, well within limits.

/**
 * Convert GPS coordinates to a short human-readable location name in Japanese.
 * Returns null on any failure (network error, rate-limit, parse error).
 */
export async function geoToLocationName(
  lat: number,
  lng: number
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=json&accept-language=ja`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Business_Card_Folder/1.0 (private)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address ?? {};
    // Build a concise "City、Prefecture" style name
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      "";
    const state = addr.state || addr.province || "";
    const parts = [city, state].filter(Boolean);
    if (parts.length) return parts.join("、");
    // Fallback: first segment of display_name
    return (data?.display_name as string | undefined)?.split(",")[0]?.trim() ?? null;
  } catch {
    return null;
  }
}
