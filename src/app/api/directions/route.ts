import { NextResponse } from 'next/server';

/**
 * POST /api/directions
 *
 * Proxies Google Maps Directions API to get real route data with traffic info.
 * Uses the server-side API key (not exposed to client).
 *
 * Request body:
 * {
 *   "origin": { "lat": number, "lng": number },
 *   "destination": { "lat": number, "lng": number },
 *   "mode": "driving" | "walking" | "transit",
 *   "alternatives": true
 * }
 */

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// Decode Google's encoded polyline algorithm
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : result >> 1);
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

interface GoogleDirectionsStep {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  duration_in_traffic?: { value: number; text: string };
  polyline: { points: string };
  html_instructions: string;
  travel_mode: string;
}

interface GoogleDirectionsLeg {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  duration_in_traffic?: { value: number; text: string };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
  steps: GoogleDirectionsStep[];
}

interface GoogleDirectionsRoute {
  summary: string;
  legs: GoogleDirectionsLeg[];
  overview_polyline: { points: string };
  warnings: string[];
}

interface GoogleDirectionsResponse {
  status: string;
  routes: GoogleDirectionsRoute[];
  error_message?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origin, destination, mode = 'driving', alternatives = true } = body;

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Missing origin or destination' },
        { status: 400 }
      );
    }

    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured on server' },
        { status: 500 }
      );
    }

    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;
    const departureTime = 'now'; // Use current traffic conditions

    // Build Google Directions API URL
    const params = new URLSearchParams({
      origin: originStr,
      destination: destStr,
      mode: mode,
      alternatives: String(alternatives),
      departure_time: departureTime,
      traffic_model: 'best_guess',
      key: GOOGLE_API_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Directions API returned ${res.status}` },
        { status: 502 }
      );
    }

    const data: GoogleDirectionsResponse = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Directions API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: `Google Directions API: ${data.status} — ${data.error_message || 'Unknown error'}` },
        { status: 502 }
      );
    }

    if (!data.routes || data.routes.length === 0) {
      return NextResponse.json(
        { error: 'No routes found', routes: [] },
        { status: 404 }
      );
    }

    // Transform Google routes to our format
    const routes = data.routes.map((route, idx) => {
      const leg = route.legs[0]; // First leg of each route
      const geometry = decodePolyline(route.overview_polyline.points);
      const hasTraffic = !!leg.duration_in_traffic;
      const trafficDuration = leg.duration_in_traffic?.value || leg.duration.value;
      const normalDuration = leg.duration.value;
      const trafficRatio = normalDuration > 0 ? trafficDuration / normalDuration : 1;

      // Determine traffic condition color
      let trafficColor = '#00ff88'; // Green — free flow
      if (trafficRatio > 1.5) trafficColor = '#ff3366'; // Red — heavy
      else if (trafficRatio > 1.3) trafficColor = '#ff8800'; // Orange — moderate-heavy
      else if (trafficRatio > 1.15) trafficColor = '#ffdd00'; // Yellow — moderate

      return {
        summary: route.summary || `Route ${idx + 1}`,
        geometry,
        distance_m: leg.distance.value,
        distance_km: Math.round((leg.distance.value / 1000) * 10) / 10,
        duration_s: leg.duration.value,
        eta_min: Math.round(leg.duration.value / 60),
        duration_in_traffic_s: trafficDuration,
        eta_traffic_min: Math.round(trafficDuration / 60),
        has_traffic_data: hasTraffic,
        traffic_ratio: Math.round(trafficRatio * 100) / 100,
        traffic_color: trafficColor,
        steps: leg.steps.map((step) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance.text,
          duration: step.duration.text,
          duration_in_traffic: step.duration_in_traffic?.text,
          geometry: decodePolyline(step.polyline.points),
        })),
      };
    });

    return NextResponse.json({
      routes,
      source: 'google-directions',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Directions API error:', err);
    return NextResponse.json(
      { error: 'Directions API request failed' },
      { status: 500 }
    );
  }
}
