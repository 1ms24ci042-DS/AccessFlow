import { Icon } from 'lucide-react';
import { ReactNode } from 'react';

export interface LocationData {
  id: string;
  name: string;
  coordinates: [number, number];
  type: 'accident' | 'flood' | 'blocked' | 'congestion' | 'clear';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: string;
  imageUrl?: string;
}

export interface RouteInfo {
  distance: string;
  duration: string;
  confidence: number;
  accessibilityScore: number;
  isWheelchairFriendly: boolean;
}

export const BANGALORE_BOUNDS: [[number, number], [number, number]] = [
  [12.83, 77.4], // Southwest
  [13.14, 77.8]  // Northeast
];

export const LOCATIONS: Record<string, [number, number]> = {
  silk_board: [12.9175, 77.6229],
  whitefield: [12.9698, 77.7499],
  ecity: [12.8399, 77.6770],
  majestic: [12.9767, 77.5713],
  hebbal: [13.0450, 77.5970],
  koramangala: [12.9279, 77.6271],
  mg_road: [12.9757, 77.6011],
  orr: [12.9352, 77.6861]
};

export const SITUATION_THEMES = {
  accident: { color: '#ef4444', label: 'Accident', icon: 'AlertTriangle' },
  flood: { color: '#0ea5e9', label: 'Flood', icon: 'Droplets' },
  blocked: { color: '#f59e0b', label: 'Blocked', icon: 'Construction' },
  congestion: { color: '#eab308', label: 'Congestion', icon: 'TrafficCone' },
  clear: { color: '#22c55e', label: 'Clear', icon: 'CheckCircle' }
};
