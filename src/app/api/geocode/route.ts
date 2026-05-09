import { NextResponse } from 'next/server';

/**
 * GET /api/geocode?q=Whitefield+Bengaluru
 *
 * Proxies Nominatim geocoding to avoid CORS issues on the client.
 * Converts typed Bengaluru addresses into coordinates.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'AccessFlow-SmartCity-Dashboard/1.0',
        },
      }
    );

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Location not found', results: [] }, { status: 404 });
    }

    const result = data[0];
    return NextResponse.json({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
  } catch {
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 503 });
  }
}
