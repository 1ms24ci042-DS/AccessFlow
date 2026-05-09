'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Car, Footprints, Accessibility, Siren, ArrowRight, MapPin, Loader2, Search, Navigation, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { RouteResponse, RouteMode, AlternateRoute, RouteData } from './types';
import { ROUTE_MODE_CONFIG, INCIDENT_COLORS } from './types';

const MODE_ICONS: Record<RouteMode, React.ElementType> = {
  driving: Car,
  walking: Footprints,
  wheelchair: Accessibility,
  emergency: Siren,
};

// Common Bengaluru locations for quick-select
const QUICK_LOCATIONS = [
  { name: 'MG Road', lat: 12.9756, lng: 77.5993 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7500 },
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Electronic City', lat: 12.8456, lng: 77.6603 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'Hebbal', lat: 13.0358, lng: 77.5970 },
  { name: 'Jayanagar', lat: 12.9250, lng: 77.5838 },
  { name: 'Majestic', lat: 12.9716, lng: 77.5946 },
];

interface Suggestion {
  description: string;
  place_id: string;
  lat?: number;
  lng?: number;
}

export default function RightPanel() {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [routeMode, setRouteMode] = useState<RouteMode>('driving');
  const [routeMessage, setRouteMessage] = useState('Try Whitefield, Koramangala, MG Road, or Electronic City.');
  const [isSearching, setIsSearching] = useState(false);

  // Autocomplete state
  const [sourceSuggestions, setSourceSuggestions] = useState<Suggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const autocompleteTimer = useRef<NodeJS.Timeout | null>(null);

  // API-driven route results
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);

  // Auto-reroute: listen for new incidents that may affect the current route
  const [rerouteAvailable, setRerouteAvailable] = useState(false);
  const lastRouteParams = useRef<{ startLat: number; startLng: number; endLat: number; endLng: number; userType: string } | null>(null);

  // Geocode address via our API proxy (Nominatim)
  const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address + ' Bengaluru')}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.lat && data.lng) return { lat: data.lat, lng: data.lng };
      return null;
    } catch {
      return null;
    }
  };

  // Google Places Autocomplete
  const fetchSuggestions = useCallback(async (query: string, type: 'source' | 'dest') => {
    if (query.length < 2) {
      if (type === 'source') setSourceSuggestions([]);
      else setDestSuggestions([]);
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
        const service = new (window as any).google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          {
            input: query + ' Bengaluru',
            componentRestrictions: { country: 'in' },
            bounds: new (window as any).google.maps.LatLngBounds(
              new (window as any).google.maps.LatLng(12.80, 77.40),
              new (window as any).google.maps.LatLng(13.15, 77.80)
            ),
          },
          (predictions: any[], status: string) => {
            if (status === 'OK' && predictions) {
              const suggestions = predictions.slice(0, 5).map((p: any) => ({
                description: p.description,
                place_id: p.place_id,
              }));
              if (type === 'source') {
                setSourceSuggestions(suggestions);
                setShowSourceSuggestions(true);
              } else {
                setDestSuggestions(suggestions);
                setShowDestSuggestions(true);
              }
            }
          }
        );
      } else {
        const filtered = QUICK_LOCATIONS.filter(
          (loc) => loc.name.toLowerCase().includes(query.toLowerCase())
        ).map((loc) => ({
          description: loc.name + ', Bengaluru',
          place_id: loc.name,
          lat: loc.lat,
          lng: loc.lng,
        }));

        if (type === 'source') {
          setSourceSuggestions(filtered);
          setShowSourceSuggestions(filtered.length > 0);
        } else {
          setDestSuggestions(filtered);
          setShowDestSuggestions(filtered.length > 0);
        }
      }
    } catch (err) {
      console.warn('Autocomplete error:', err);
    }
  }, []);

  const handleInputChange = useCallback((value: string, type: 'source' | 'dest') => {
    if (type === 'source') setSource(value);
    else setDestination(value);

    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    autocompleteTimer.current = setTimeout(() => fetchSuggestions(value, type), 300);
  }, [fetchSuggestions]);

  const selectSuggestion = useCallback(async (suggestion: Suggestion, type: 'source' | 'dest') => {
    const name = suggestion.description.split(',')[0];
    if (type === 'source') {
      setSource(name);
      setShowSourceSuggestions(false);
    } else {
      setDestination(name);
      setShowDestSuggestions(false);
    }
  }, []);

  const selectQuickLocation = useCallback((loc: typeof QUICK_LOCATIONS[0], type: 'source' | 'dest') => {
    if (type === 'source') {
      setSource(loc.name);
      setShowSourceSuggestions(false);
    } else {
      setDestination(loc.name);
      setShowDestSuggestions(false);
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sourceInputRef.current && !sourceInputRef.current.contains(e.target as Node)) {
        setShowSourceSuggestions(false);
      }
      if (destInputRef.current && !destInputRef.current.contains(e.target as Node)) {
        setShowDestSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ====== Route search handler ======
  const handleSearchRoute = async () => {
    if (!source.trim() || !destination.trim()) {
      toast.error('Please enter both source and destination');
      return;
    }

    setIsSearching(true);
    setRouteMessage('Geocoding addresses...');

    const [srcCoords, destCoords] = await Promise.all([
      geocode(source),
      geocode(destination),
    ]);

    if (!srcCoords || !destCoords) {
      const notFound = !srcCoords ? source : destination;
      setRouteMessage(`Could not find: ${notFound}`);
      toast.error(`Geocoding failed for: ${notFound}`);
      setIsSearching(false);
      return;
    }

    const modeConfig = ROUTE_MODE_CONFIG[routeMode];
    setRouteMessage(`Geocoded → Requesting ${modeConfig.label} route...`);

    // Save for auto-reroute
    lastRouteParams.current = {
      startLat: srcCoords.lat,
      startLng: srcCoords.lng,
      endLat: destCoords.lat,
      endLng: destCoords.lng,
      userType: modeConfig.backendUserType,
    };

    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [srcCoords.lat, srcCoords.lng],
          end: [destCoords.lat, destCoords.lng],
          user_type: modeConfig.backendUserType,
          route_mode: routeMode,
        }),
      });

      if (!res.ok) {
        throw new Error('Route API error');
      }

      const data: RouteResponse = await res.json();
      setRouteResult(data);
      setRerouteAvailable(false);

      // Dispatch route result to MapPanel
      window.dispatchEvent(new CustomEvent('accessflow-route-result', { detail: data }));

      setRouteMessage(
        `Route via ${data.source} | Recommended: ${data.recommended.eta_min}m / ${data.recommended.distance_km}km | ${data.alternates.length} alternate(s)`
      );

      toast.success('Routes computed', {
        description: `AI: ${data.recommended.confidence}% | Access: ${data.recommended.accessibility_score}/100 | Incidents: ${data.total_incidents_considered}`,
      });
    } catch (err) {
      setRouteMessage('Route computation failed — try again');
      toast.error('Failed to compute route');
    } finally {
      setIsSearching(false);
    }
  };

  // ====== Auto-reroute: listen for new incidents ======
  useEffect(() => {
    const handleNewIncident = () => {
      // If we have an active route, offer to reroute
      if (lastRouteParams.current && routeResult) {
        setRerouteAvailable(true);
        toast.warning('New incident detected near your route!', {
          description: 'Automatically rerouting to find a safer path...',
          duration: 8000,
        });
        // Auto-reroute hardcode
        handleReroute();
      }
    };

    window.addEventListener('accessflow-new-incident', handleNewIncident as EventListener);
    return () => window.removeEventListener('accessflow-new-incident', handleNewIncident as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeResult]);

  // ====== Reroute handler ======
  const handleReroute = async () => {
    if (!lastRouteParams.current) return;

    setRerouteAvailable(false);
    setIsSearching(true);
    setRouteMessage('Rerouting — avoiding new incident...');

    try {
      const params = lastRouteParams.current;
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [params.startLat, params.startLng],
          end: [params.endLat, params.endLng],
          user_type: params.userType,
          route_mode: routeMode,
        }),
      });

      if (!res.ok) throw new Error('Reroute API error');

      const data: RouteResponse = await res.json();
      setRouteResult(data);

      window.dispatchEvent(new CustomEvent('accessflow-route-result', { detail: data }));

      setRouteMessage(
        `Rerouted via ${data.source} | ${data.recommended.eta_min}m / ${data.recommended.distance_km}km | Incidents: ${data.total_incidents_considered}`
      );

      toast.success('Route updated!', {
        description: `New path avoids the incident. AI confidence: ${data.recommended.confidence}%`,
      });
    } catch (err) {
      setRouteMessage('Reroute failed — try manual search');
      toast.error('Reroute failed');
    } finally {
      setIsSearching(false);
    }
  };

  const currentModeConfig = ROUTE_MODE_CONFIG[routeMode];

  return (
    <aside className="flex flex-col gap-3 lg:w-[320px] min-w-0" aria-label="Routing and analytics panel">
      {/* Route Planner */}
      <section className="glass-panel p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-[#3388ff]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#3388ff]">Routing</span>
          </div>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono border shrink-0"
            style={{
              background: `${currentModeConfig.color}18`,
              color: currentModeConfig.color,
              borderColor: `${currentModeConfig.color}40`,
            }}
          >
            {currentModeConfig.label}
          </span>
        </div>

        {/* Transport Mode Selector */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[rgba(51,136,255,0.12)]">
          {(Object.keys(ROUTE_MODE_CONFIG) as RouteMode[]).map((mode) => {
            const config = ROUTE_MODE_CONFIG[mode];
            const Icon = MODE_ICONS[mode];
            const isActive = routeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setRouteMode(mode)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md text-[10px] font-mono transition-all ${
                  isActive
                    ? 'text-white border'
                    : 'text-[rgba(224,230,240,0.35)] hover:text-[rgba(224,230,240,0.6)] hover:bg-[rgba(255,255,255,0.03)]'
                }`}
                style={isActive ? {
                  background: `${config.color}20`,
                  borderColor: `${config.color}50`,
                  color: config.color,
                  boxShadow: `0 0 10px ${config.color}20`,
                } : {}}
                title={`${config.label} (${config.backendUserType})`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate w-full text-center leading-tight">{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* Source */}
        <div className="flex flex-col gap-1 relative">
          <Label className="text-[10px] font-mono uppercase tracking-wider text-[rgba(224,230,240,0.4)]">Source</Label>
          <div className="relative" ref={sourceInputRef}>
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3388ff] opacity-50 z-10" />
            <Input
              value={source}
              onChange={(e) => handleInputChange(e.target.value, 'source')}
              onFocus={() => sourceSuggestions.length > 0 && setShowSourceSuggestions(true)}
              placeholder="Whitefield"
              className="pl-8 h-8 bg-[rgba(0,0,0,0.3)] border-[rgba(51,136,255,0.15)] text-sm font-mono text-[#e0e6f0] placeholder:text-[rgba(224,230,240,0.2)] focus:border-[rgba(51,136,255,0.4)]"
            />
            {showSourceSuggestions && sourceSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[rgba(10,14,23,0.98)] border border-[rgba(51,136,255,0.25)] rounded-lg overflow-hidden z-[9000] max-h-48 overflow-y-auto">
                {sourceSuggestions.map((s, i) => (
                  <button key={s.place_id || i} type="button" onClick={() => selectSuggestion(s, 'source')}
                    className="w-full text-left px-3 py-2 text-[11px] font-mono text-[rgba(224,230,240,0.7)] hover:bg-[rgba(51,136,255,0.1)] hover:text-[#3388ff] transition-colors flex items-center gap-2">
                    <Search className="w-3 h-3 text-[rgba(51,136,255,0.4)] shrink-0" />
                    <span className="truncate">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Destination */}
        <div className="flex flex-col gap-1 relative">
          <Label className="text-[10px] font-mono uppercase tracking-wider text-[rgba(224,230,240,0.4)]">Destination</Label>
          <div className="relative" ref={destInputRef}>
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#ff3366] opacity-50 z-10" />
            <Input
              value={destination}
              onChange={(e) => handleInputChange(e.target.value, 'dest')}
              onFocus={() => destSuggestions.length > 0 && setShowDestSuggestions(true)}
              placeholder="MG Road"
              className="pl-8 h-8 bg-[rgba(0,0,0,0.3)] border-[rgba(51,136,255,0.15)] text-sm font-mono text-[#e0e6f0] placeholder:text-[rgba(224,230,240,0.2)] focus:border-[rgba(51,136,255,0.4)]"
            />
            {showDestSuggestions && destSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[rgba(10,14,23,0.98)] border border-[rgba(51,136,255,0.25)] rounded-lg overflow-hidden z-[9000] max-h-48 overflow-y-auto">
                {destSuggestions.map((s, i) => (
                  <button key={s.place_id || i} type="button" onClick={() => selectSuggestion(s, 'dest')}
                    className="w-full text-left px-3 py-2 text-[11px] font-mono text-[rgba(224,230,240,0.7)] hover:bg-[rgba(51,136,255,0.1)] hover:text-[#3388ff] transition-colors flex items-center gap-2">
                    <Search className="w-3 h-3 text-[rgba(51,136,255,0.4)] shrink-0" />
                    <span className="truncate">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick locations */}
        <div className="flex flex-wrap gap-1">
          {QUICK_LOCATIONS.slice(0, 5).map((loc) => (
            <button key={loc.name} type="button" onClick={() => {
              if (!source) selectQuickLocation(loc, 'source');
              else if (!destination) selectQuickLocation(loc, 'dest');
            }}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[rgba(51,136,255,0.06)] text-[rgba(51,136,255,0.6)] border border-[rgba(51,136,255,0.12)] cursor-pointer hover:bg-[rgba(51,136,255,0.12)] transition-colors"
            >
              {loc.name}
            </button>
          ))}
        </div>

        {/* Search + Reroute buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSearchRoute}
            disabled={isSearching}
            className="flex-1 text-xs font-mono gap-2 bg-[rgba(51,136,255,0.12)] text-[#3388ff] border border-[rgba(51,136,255,0.3)] hover:bg-[rgba(51,136,255,0.2)] h-8"
            variant="outline"
          >
            {isSearching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing...</>
            ) : (
              <><ArrowRight className="w-3.5 h-3.5" /> Find {currentModeConfig.label} Route</>
            )}
          </Button>
          <Button
            onClick={() => {
               window.dispatchEvent(new CustomEvent('accessflow-new-incident', {
                 detail: {
                   type: 'ACCIDENT', severity: 'HIGH', confidence: 95,
                   description: 'Simulated accident near route',
                   emergency: true, accessible: false,
                   lat: lastRouteParams.current ? lastRouteParams.current.startLat + 0.005 : 12.9756,
                   lng: lastRouteParams.current ? lastRouteParams.current.startLng + 0.005 : 77.5993,
                 }
               }));
            }}
            className="text-xs font-mono bg-[rgba(255,51,102,0.15)] text-[#ff3366] border border-[rgba(255,51,102,0.3)] hover:bg-[rgba(255,51,102,0.25)] h-8 px-2"
            variant="outline"
            title="Simulate Accident"
          >
            Simulate
          </Button>
          {rerouteAvailable && (
            <Button
              onClick={handleReroute}
              disabled={isSearching}
              className="text-xs font-mono gap-1 bg-[rgba(255,136,0,0.15)] text-[#ff8800] border border-[rgba(255,136,0,0.3)] hover:bg-[rgba(255,136,0,0.25)] h-8 animate-pulse px-2"
              variant="outline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reroute
            </Button>
          )}
        </div>

        <p className="text-[10px] font-mono text-[rgba(224,230,240,0.3)] leading-relaxed">{routeMessage}</p>
      </section>

      {/* Route Analytics */}
      <section className="glass-panel p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-[#3388ff]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#3388ff]">Route Analytics</span>
          </div>
          <span className="text-[10px] font-mono text-[rgba(224,230,240,0.3)]">
            {routeResult ? `${routeResult.source} · ${routeResult.model_used}` : 'No route yet'}
          </span>
        </div>

        {/* Unified Route List */}
        {routeResult && (() => {
          const allRoutes = [routeResult.recommended, ...routeResult.alternates].sort((a, b) => b.confidence - a.confidence);
          return (
            <div className="flex flex-col gap-2">
              {allRoutes.map((route, idx) => {
                const isHighest = idx === 0;
                return (
                  <article key={idx} className={`p-2.5 rounded-lg border ${isHighest ? 'bg-[rgba(0,255,136,0.04)] border-[rgba(0,255,136,0.12)]' : 'bg-[rgba(255,136,0,0.03)] border-[rgba(255,136,0,0.08)]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-5 h-0.5 rounded" style={{ background: route.color || '#ff8800' }} />
                      <strong className="text-[10px] font-mono">{route.name}</strong>
                      {isHighest && <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-[rgba(0,255,136,0.15)] text-[#00ff88] border border-[rgba(0,255,136,0.3)]">HIGHEST CONFIDENCE</span>}
                    </div>
                    <dl className="grid grid-cols-4 gap-1 text-center">
                      <div>
                        <dt className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">ETA</dt>
                        <dd className="text-[11px] font-mono" style={{ color: isHighest ? '#00ff88' : 'inherit' }}>{route.eta_min}m</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">Dist</dt>
                        <dd className="text-[11px] font-mono text-[rgba(224,230,240,0.7)]">{route.distance_km}km</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">Conf</dt>
                        <dd className="text-[11px] font-mono" style={{ color: isHighest ? '#00ff88' : '#ffdd00' }}>{route.confidence}%</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">Access</dt>
                        <dd className="text-[11px] font-mono text-[#3388ff]">{route.accessibility_score}</dd>
                      </div>
                    </dl>
                    {route.incidents_nearby > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono text-[rgba(255,136,0,0.7)]">
                        <AlertTriangle className="w-3 h-3" />
                        {route.incidents_nearby} incident(s) nearby
                      </div>
                    )}
                    {route.explanation && !isHighest && (
                      <p className="mt-1 text-[9px] font-mono text-[rgba(224,230,240,0.35)] truncate">{route.explanation}</p>
                    )}
                  </article>
                );
              })}
            </div>
          );
        })()}

        {/* AI Explanation */}
        <div className="p-2.5 rounded-lg bg-[rgba(51,136,255,0.04)] border border-[rgba(51,136,255,0.1)]">
          <div className="flex items-center gap-1.5 mb-1">
            <Siren className="w-3 h-3 text-[#3388ff]" />
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#3388ff]">AI Explanation</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[rgba(224,230,240,0.5)]">
            {routeResult?.recommended?.explanation || 'Search for a route to see AI analysis and accessibility explanation.'}
          </p>
        </div>

        {/* Incidents considered */}
        {routeResult && routeResult.total_incidents_considered > 0 && (
          <div className="px-2.5 py-1.5 rounded-lg bg-[rgba(255,51,102,0.04)] border border-[rgba(255,51,102,0.1)] flex items-center gap-2 text-[10px] font-mono">
            <AlertTriangle className="w-3 h-3 text-[#ff3366]" />
            <span className="text-[rgba(224,230,240,0.5)]">
              <strong className="text-[#ff3366]">{routeResult.total_incidents_considered}</strong> incident(s) considered by AI
            </span>
            <span className="ml-auto text-[rgba(224,230,240,0.3)]">Model: {routeResult.model_used}</span>
          </div>
        )}
      </section>
    </aside>
  );
}
