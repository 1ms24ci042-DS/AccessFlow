// ============================================================
// Types matching the FastAPI backend (routing_agent.py + vlm.py)
// Backend: POST http://localhost:8000/route, POST http://localhost:8000/analyze
// ============================================================

// --- VLM Incident Types (matches vlm.py exactly) ---
export type IncidentType = 'ACCIDENT' | 'FLOOD' | 'BLOCKED' | 'CONGESTION' | 'CLEAR';

// Backend uses HIGH/MEDIUM/LOW (not Critical/High/Medium/Low/None)
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

// User types from routing_agent.py
export type BackendUserType = 'general' | 'wheelchair' | 'visually_impaired' | 'mobility_aid';

// Frontend route modes → map to backend user_type
export type RouteMode = 'driving' | 'walking' | 'wheelchair' | 'emergency';

export const ROUTE_MODE_CONFIG: Record<RouteMode, {
  label: string;
  osrmProfile: string;
  icon: string;
  color: string;
  backendUserType: BackendUserType;
}> = {
  driving: { label: 'Drive', osrmProfile: 'driving', icon: 'car', color: '#3388ff', backendUserType: 'general' },
  walking: { label: 'Walk', osrmProfile: 'foot', icon: 'walk', color: '#00ff88', backendUserType: 'general' },
  wheelchair: { label: 'Wheelchair', osrmProfile: 'foot', icon: 'wheelchair', color: '#00f0ff', backendUserType: 'wheelchair' },
  emergency: { label: 'Emergency', osrmProfile: 'driving', icon: 'siren', color: '#ff3366', backendUserType: 'general' },
};

export type MapStyle = 'streets' | 'dark' | 'tactical' | 'satellite' | 'terrain' | 'google';

// ============================================================
// VLM Response (matches vlm.py _validate_result exactly)
// ============================================================
export interface VLMResult {
  type: IncidentType;
  severity: Severity;
  description: string;
  emergency: boolean;     // true if emergency services needed
  accessible: boolean;    // true if wheelchair user can safely pass
}

// Extended VLM result with metadata from our /api/analyze proxy
export interface VLMAnalysisResponse extends VLMResult {
  confidence: number;     // 0-100, computed by proxy
  source: string;         // 'fastapi-vlm' | 'vlm-z-ai' | 'fallback'
  timestamp: string;
  risk_factors?: string[];
  recommended_action?: string;
}

// ============================================================
// Incident Pin (for map markers)
// ============================================================
export interface IncidentPin {
  id: number;
  type: IncidentType;
  severity: Severity;
  lat: number;
  lng: number;
  confidence: number;
  accessible: boolean;    // from VLM: can wheelchair pass?
  emergency: boolean;     // from VLM: emergency services needed?
  description: string;
}

// --- Pins API response ---
export interface PinsResponse {
  pins: IncidentPin[];
  timestamp: string;
  source: string;
}

// ============================================================
// Route Data (matches routing_agent.py scored_routes exactly)
// ============================================================

// Backend route shape from plan_route()
export interface BackendRoute {
  name: string;                  // "Route A via HAL Old Airport Rd"
  distance: string;              // "12.5 km" (formatted)
  time: string;                  // "25 min" (formatted)
  confidence: number;            // 0-100
  accessibility_score: number;   // 0-100
  explanation: string;           // AI explanation
  incidents_nearby: number;      // count of incidents near route
  waypoints: [number, number][]; // [lat, lng] pairs
}

// Backend plan_route() response
export interface BackendRouteResponse {
  status: 'ok' | 'error';
  user_type: string;
  recommended_route: BackendRoute | null;
  alternate_routes: BackendRoute[];
  total_incidents_considered: number;
  model_used: string;           // "gemma3:4b"
  error?: string;
}

// ============================================================
// Frontend route types (normalized from backend + fallbacks)
// ============================================================
export interface RouteData {
  name: string;
  color: string;
  geometry: [number, number][];
  eta_min: number;               // parsed from "25 min"
  distance_km: number;           // parsed from "12.5 km"
  confidence: number;
  accessibility_score: number;
  incidents_nearby: number;
  explanation: string;
  risk_factors: string[];
}

export interface AlternateRoute {
  name: string;
  color: string;
  geometry: [number, number][];
  eta_min: number;
  distance_km: number;
  confidence: number;
  accessibility_score: number;
  incidents_nearby: number;
  explanation: string;
}

// Frontend route response (normalized)
export interface RouteResponse {
  recommended: RouteData;
  alternates: AlternateRoute[];
  user_type: string;
  model_used: string;
  total_incidents_considered: number;
  timestamp: string;
  source: string;
  traffic_info?: {
    has_traffic_data: boolean;
    traffic_ratio: number;
    normal_duration_s: number;
    traffic_duration_s: number;
  };
}

// ============================================================
// Geocode
// ============================================================
export interface GeocodeResponse {
  display_name: string;
  lat: number;
  lng: number;
}

// ============================================================
// Constants
// ============================================================
export const INCIDENT_COLORS: Record<IncidentType, string> = {
  ACCIDENT: '#ff3366',
  FLOOD: '#3388ff',
  BLOCKED: '#ff8800',
  CONGESTION: '#ffdd00',
  CLEAR: '#00ff88',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  HIGH: '#ff3366',
  MEDIUM: '#ff8800',
  LOW: '#ffdd00',
};

export const MAP_STYLES: { key: MapStyle; label: string }[] = [
  { key: 'streets', label: 'Streets' },
  { key: 'dark', label: 'Dark' },
  { key: 'tactical', label: 'Voyager' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'google', label: 'Google' },
];

// Parse backend distance string "12.5 km" → number
export function parseDistance(dist: string): number {
  const match = dist.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Parse backend time string "25 min" or "1h 30min" → minutes
export function parseDuration(time: string): number {
  let minutes = 0;
  const hMatch = time.match(/(\d+)\s*h/);
  const mMatch = time.match(/(\d+)\s*min/);
  if (hMatch) minutes += parseInt(hMatch[1]) * 60;
  if (mMatch) minutes += parseInt(mMatch[1]);
  return minutes || 0;
}
