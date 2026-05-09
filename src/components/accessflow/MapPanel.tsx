'use client';

import { useState, useEffect, useCallback } from 'react';
import { Map as LeafletMap } from 'leaflet';
import { MAP_STYLES, type MapStyle, type IncidentPin, type RouteResponse, type PinsResponse } from './types';

// This component MUST be dynamically imported with { ssr: false }
export default function MapPanel() {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [showTraffic, setShowTraffic] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('Waiting for location');
  const [lastPinUpdate, setLastPinUpdate] = useState<string>('');

  // API-driven state
  const [pins, setPins] = useState<IncidentPin[]>([]);
  const [routes, setRoutes] = useState<{
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
  }>({});
  const [routeSource, setRouteSource] = useState<string>('');

  // Fetch incident pins every 10 seconds
  useEffect(() => {
    let mounted = true;

    const fetchPins = async () => {
      try {
        const res = await fetch('/api/pins');
        const data: PinsResponse = await res.json();
        if (mounted && data.pins) {
          setPins(data.pins);
          setLastPinUpdate(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed to fetch pins:', err);
      }
    };

    fetchPins();
    const interval = setInterval(fetchPins, 10000);

    const handleNewIncident = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newPin = customEvent.detail;
      if (newPin && newPin.lat && newPin.lng) {
        setPins(prev => {
          // Check if it already exists to avoid duplicates
          if (prev.some(p => p.lat === newPin.lat && p.lng === newPin.lng)) return prev;
          return [{
            id: Date.now(), // Generate temporary ID
            ...newPin
          }, ...prev];
        });
      }
    };

    window.addEventListener('accessflow-new-incident', handleNewIncident);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('accessflow-new-incident', handleNewIncident);
    };
  }, []);

  // Draw routes from API response (dispatched by RightPanel)
  useEffect(() => {
    const handleRouteResult = (e: CustomEvent) => {
      const data: RouteResponse = e.detail;
      if (data) {
        setRoutes({
          recommended: data.recommended,
          alternates: data.alternates,
        });
        setRouteSource(data.source || '');
      }
    };

    window.addEventListener('accessflow-route-result', handleRouteResult as EventListener);
    return () => window.removeEventListener('accessflow-route-result', handleRouteResult as EventListener);
  }, []);

  // Dynamic import of Leaflet map
  useEffect(() => {
    import('./LeafletMapInner').then((mod) => {
      setMapComponent(() => mod.default);
    });
  }, []);

  const handleMapReady = useCallback((map: LeafletMap) => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => setGpsStatus(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
        () => setGpsStatus('GPS unavailable'),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  return (
    <section className="glass-panel flex flex-col gap-0 overflow-hidden relative min-h-[400px] lg:min-h-0" aria-label="Live Bengaluru smart map">
      {/* Map Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 border-b border-[rgba(51,136,255,0.15)]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-[rgba(51,136,255,0.5)] font-mono">Live Smart Map</p>
          <h2 className="text-sm font-bold text-[#3388ff]" style={{ textShadow: '0 0 10px rgba(51,136,255,0.4)' }}>Bengaluru Accessibility Layer</h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-[rgba(224,230,240,0.5)]">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#ff3366]" />Accident</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#3388ff]" />Flood</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#ff8800]" />Blocked</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#ffdd00]" />Congestion</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#00ff88]" />Clear</span>
        </div>

        {/* Map controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Google Maps Traffic toggle */}
          <button
            type="button"
            onClick={() => setShowTraffic(!showTraffic)}
            className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1 ${
              showTraffic
                ? 'bg-[rgba(0,255,136,0.12)] text-[#00ff88] border border-[rgba(0,255,136,0.3)]'
                : 'text-[rgba(224,230,240,0.35)] hover:text-[rgba(224,230,240,0.6)] bg-[rgba(0,0,0,0.3)] border border-[rgba(51,136,255,0.1)]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${showTraffic ? 'bg-[#00ff88] pulse-dot' : 'bg-[rgba(224,230,240,0.3)]'}`} />
            Traffic{showTraffic ? ' Live' : ''}
          </button>

          {/* Map style switcher */}
          <div className="flex items-center gap-0.5 bg-[rgba(0,0,0,0.4)] rounded-lg p-0.5 flex-wrap">
            {MAP_STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setMapStyle(s.key)}
                className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all ${
                  mapStyle === s.key
                    ? 'bg-[rgba(51,136,255,0.2)] text-[#3388ff] border border-[rgba(51,136,255,0.4)]'
                    : 'text-[rgba(224,230,240,0.35)] hover:text-[rgba(224,230,240,0.6)]'
                }`}
                aria-pressed={mapStyle === s.key}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative min-h-[350px]">
        {MapComponent ? (
          <MapComponent mapStyle={mapStyle} onMapReady={handleMapReady} pins={pins} routes={routes} showTraffic={showTraffic} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-[rgba(51,136,255,0.3)] border-t-[#3388ff] rounded-full animate-spin" />
              <span className="text-xs font-mono text-[rgba(51,136,255,0.5)]">Loading map tiles...</span>
            </div>
          </div>
        )}
      </div>

      {/* GPS Status Card */}
      <div className="absolute bottom-12 left-3 z-[1000] glass-panel px-3 py-1.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#3388ff] pulse-dot" />
        <span className="text-[10px] font-mono text-[rgba(224,230,240,0.4)]">GPS</span>
        <strong className="text-[10px] font-mono text-[#3388ff]">{gpsStatus}</strong>
      </div>

      {/* Pin update timestamp */}
      <div className="absolute bottom-12 right-3 z-[1000] glass-panel px-3 py-1.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] pulse-dot" />
        <span className="text-[10px] font-mono text-[rgba(224,230,240,0.3)]">Pins updated</span>
        <strong className="text-[10px] font-mono text-[rgba(224,230,240,0.5)]">{lastPinUpdate || '—'}</strong>
      </div>

      {/* Map KPI Dock */}
      <div className="flex items-center gap-3 p-2 border-t border-[rgba(51,136,255,0.15)] bg-[rgba(0,0,0,0.3)]">
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-mono text-[rgba(224,230,240,0.3)]">Incidents</span>
          <strong className="text-sm font-mono text-[#ff3366]">{pins.length}</strong>
        </div>
        <div className="w-px h-6 bg-[rgba(51,136,255,0.1)]" />
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-mono text-[rgba(224,230,240,0.3)]">Hazard</span>
          <strong className="text-sm font-mono text-[#ff3366]">{pins.some(p => p.severity === 'HIGH' || p.emergency) ? 'HIGH' : pins.some(p => p.severity === 'MEDIUM') ? 'MED' : 'LOW'}</strong>
        </div>
        <div className="w-px h-6 bg-[rgba(51,136,255,0.1)]" />
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-mono text-[rgba(224,230,240,0.3)]">Safe ETA</span>
          <strong className="text-sm font-mono text-[#3388ff]">{routes.recommended ? `${routes.recommended.eta_min}m` : '—'}</strong>
        </div>
        <div className="w-px h-6 bg-[rgba(51,136,255,0.1)]" />
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-mono text-[rgba(224,230,240,0.3)]">Routing</span>
          <strong className="text-sm font-mono text-[#00ff88]">{routes.recommended ? (routeSource || 'AI+OSRM') : 'Ready'}</strong>
        </div>
      </div>
    </section>
  );
}
