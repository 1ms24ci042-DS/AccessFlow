'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.gridlayer.googlemutant';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import type { MapStyle, IncidentPin } from './types';
import { INCIDENT_COLORS } from './types';

// Fix leaflet default icon issue in Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ============================================================
// MAP TILE PROVIDERS
// ============================================================
const TILE_LAYERS: Record<string, { url: string; attribution: string; maxZoom?: number }> = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  tactical: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 18,
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
  google: {
    url: '',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
};

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
const BENGALURU_BOUNDS = L.latLngBounds(L.latLng(12.80, 77.40), L.latLng(13.15, 77.80));

// ============================================================
// INCIDENT ICON
// ============================================================
function createIncidentIcon(type: string, color: string, emergency: boolean = false) {
  const size = emergency ? 24 : 18;
  const glow = emergency ? `0 0 20px ${color}, 0 0 40px ${color}80` : `0 0 14px ${color}, 0 0 28px ${color}80`;
  return L.divIcon({
    className: 'incident-marker',
    html: `<div style="
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: ${color}; border: 3px solid rgba(255,255,255,0.9);
      box-shadow: ${glow};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// ============================================================
// MAP CONTROLLER
// ============================================================
function MapController({ mapStyle }: { mapStyle: MapStyle }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map, mapStyle]);
  return null;
}

// ============================================================
// GPS MARKER
// ============================================================
function GPSMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#3388ff;border:3px solid white;box-shadow:0 0 14px #3388ff,0 0 28px #3388ff80;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })}
    >
      <Popup>
        <div className="text-xs font-mono">
          <strong style={{ color: '#3388ff' }}>Your Location</strong><br />
          <span style={{ color: 'rgba(224,230,240,0.6)' }}>{position[0].toFixed(4)}, {position[1].toFixed(4)}</span>
        </div>
      </Popup>
    </Marker>
  );
}

// ============================================================
// SAFE POLYLINE
// ============================================================
function SafePolyline({ positions, color, weight = 3, dashArray }: {
  positions: [number, number][];
  color: string;
  weight?: number;
  dashArray?: string;
}) {
  const valid = useMemo(() => {
    if (!positions || !Array.isArray(positions)) return [];
    return positions.filter(
      (p): p is [number, number] =>
        Array.isArray(p) && p.length === 2 &&
        typeof p[0] === 'number' && typeof p[1] === 'number' &&
        !isNaN(p[0]) && !isNaN(p[1]) && isFinite(p[0]) && isFinite(p[1]) &&
        Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
    );
  }, [positions]);

  if (valid.length < 2) return null;

  return <Polyline positions={valid} pathOptions={{ color, weight, opacity: 0.9, dashArray, lineCap: 'round', lineJoin: 'round' }} />;
}

// ============================================================
// GOOGLE MAPS TRAFFIC LAYER
// ============================================================
function GoogleTrafficLayer({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const trafficRef = useRef<L.GridLayer | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (trafficRef.current) {
        map.removeLayer(trafficRef.current);
        trafficRef.current = null;
      }
      return;
    }

    try {
      // @ts-expect-error — googleMutant extends L.GridLayer but typings are missing
      const trafficLayer = L.gridLayer.googleMutant({
        type: 'roadmap',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0a0e17' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: 'transparent' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: 'transparent' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
          { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0e17' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0a0e17' }] },
          { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'all', stylers: [{ visibility: 'off' }] },
        ],
        traffic: true,
        opacity: 0.85,
        maxZoom: 20,
      });

      trafficLayer.addTo(map);
      trafficRef.current = trafficLayer;
    } catch (err) {
      console.warn('Google Maps traffic layer failed:', err);
      try {
        const fallbackTraffic = L.tileLayer(
          'https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&style=3',
          { subdomains: '0123', opacity: 0.6, maxZoom: 20 }
        );
        fallbackTraffic.addTo(map);
        trafficRef.current = fallbackTraffic;
      } catch (fallbackErr) {
        console.error('Traffic fallback failed:', fallbackErr);
      }
    }

    return () => {
      if (trafficRef.current) {
        map.removeLayer(trafficRef.current);
        trafficRef.current = null;
      }
    };
  }, [map, enabled]);

  return null;
}

// ============================================================
// GOOGLE MAPS BASE LAYER
// ============================================================
function GoogleBaseLayer({ active }: { active: boolean }) {
  const map = useMap();
  const baseRef = useRef<L.GridLayer | null>(null);

  useEffect(() => {
    if (!active) {
      if (baseRef.current) {
        map.removeLayer(baseRef.current);
        baseRef.current = null;
      }
      return;
    }

    try {
      // @ts-expect-error — googleMutant extends L.GridLayer
      const googleBase = L.gridLayer.googleMutant({ type: 'roadmap', maxZoom: 20 });
      googleBase.addTo(map);
      baseRef.current = googleBase;
    } catch (err) {
      console.warn('Google base layer failed:', err);
    }

    return () => {
      if (baseRef.current) {
        map.removeLayer(baseRef.current);
        baseRef.current = null;
      }
    };
  }, [map, active]);

  return null;
}

// ============================================================
// MAIN MAP COMPONENT
// ============================================================
interface LeafletMapInnerProps {
  mapStyle: MapStyle;
  onMapReady?: (map: L.Map) => void;
  pins: IncidentPin[];
  routes: {
    recommended?: {
      name: string;
      color: string;
      geometry: [number, number][];
      eta_min: number;
      distance_km: number;
      confidence: number;
      accessibility_score: number;
      incidents_nearby: number;
      explanation: string;
    };
    alternates?: Array<{
      name: string;
      color: string;
      geometry: [number, number][];
      eta_min: number;
      distance_km: number;
      confidence: number;
      accessibility_score: number;
      incidents_nearby: number;
      explanation: string;
    }>;
  };
  showTraffic?: boolean;
}

export default function LeafletMapInner({ mapStyle, onMapReady, pins, routes, showTraffic = false }: LeafletMapInnerProps) {
  const tileConfig = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;
  const isGoogleStyle = mapStyle === 'google';

  const handleMapCreated = (map: L.Map) => {
    if (onMapReady) onMapReady(map);
  };

  return (
    <MapContainer
      center={BENGALURU_CENTER}
      zoom={13}
      className="w-full h-full"
      style={{ minHeight: '350px', background: '#0a0e17' }}
      maxBounds={BENGALURU_BOUNDS}
      maxBoundsViscosity={0.7}
      zoomControl={true}
      whenReady={(e) => handleMapCreated(e.target as L.Map)}
    >
      {/* Standard TileLayer */}
      {!isGoogleStyle && (
        <TileLayer
          key={mapStyle}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={tileConfig.maxZoom || 19}
        />
      )}

      {/* Google Maps base layer */}
      <GoogleBaseLayer active={isGoogleStyle} />

      <MapController mapStyle={mapStyle} />

      {/* Google Maps Traffic Layer */}
      <GoogleTrafficLayer enabled={showTraffic} />

      {/* ====== INCIDENT PINS ====== */}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={createIncidentIcon(pin.type, INCIDENT_COLORS[pin.type], pin.emergency)}
        >
          <Popup>
            <div className="font-mono" style={{ minWidth: '170px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: INCIDENT_COLORS[pin.type],
                  boxShadow: `0 0 8px ${INCIDENT_COLORS[pin.type]}`,
                  display: 'inline-block',
                }} />
                <strong style={{ color: INCIDENT_COLORS[pin.type], fontSize: '13px' }}>{pin.type}</strong>
                {pin.emergency && <span style={{ color: '#ff3366', fontSize: '11px', fontWeight: 'bold' }}>EMERGENCY</span>}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(224,230,240,0.7)', lineHeight: '1.7' }}>
                <div><span style={{ color: 'rgba(51,136,255,0.8)' }}>Severity:</span> {pin.severity}</div>
                <div><span style={{ color: 'rgba(51,136,255,0.8)' }}>Confidence:</span> {pin.confidence}%</div>
                <div><span style={{ color: 'rgba(51,136,255,0.8)' }}>Accessible:</span> <span style={{ color: pin.accessible ? '#00ff88' : '#ff3366' }}>{pin.accessible ? 'Yes' : 'No'}</span></div>
                <div style={{ marginTop: '4px', color: 'rgba(224,230,240,0.5)' }}>{pin.description}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* ====== RECOMMENDED ROUTE — Green glow ====== */}
      {routes.recommended && routes.recommended.geometry.length >= 2 && (
        <>
          <SafePolyline positions={routes.recommended.geometry} color="#3388ff" weight={7} dashArray="6 10" />
          <SafePolyline positions={routes.recommended.geometry} color="#00ff88" weight={3} />
        </>
      )}

      {/* ====== ALTERNATE ROUTES — dashed, various colors ====== */}
      {routes.alternates?.map((alt, i) => (
        alt.geometry.length >= 2 && (
          <SafePolyline
            key={`alt-${i}`}
            positions={alt.geometry}
            color={alt.color || (i === 0 ? '#ff8800' : '#ffdd00')}
            weight={3}
            dashArray="8 6"
          />
        )
      ))}

      {/* ====== GPS MARKER ====== */}
      <GPSMarker />
    </MapContainer>
  );
}
