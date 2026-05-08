import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { BANGALORE_BOUNDS, LOCATIONS, LocationData, SITUATION_THEMES, RouteInfo } from '../types';
import { AlertTriangle, Droplets, Construction, TrafficCone, Compass, Clock, MapPin, Accessibility as AccessibilityIcon, Info } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motion, AnimatePresence } from 'motion/react';

interface MapViewProps {
  situations: LocationData[];
  onMarkerClick: (loc: LocationData) => void;
  accessibilityMode: boolean;
}

const DEFAULT_ROUTE: RouteInfo = {
  distance: "12.4 km",
  duration: "42 min",
  confidence: 88,
  accessibilityScore: 92,
  isWheelchairFriendly: true
};

const createCustomIcon = (type: string, severity: string) => {
  const theme = SITUATION_THEMES[type as keyof typeof SITUATION_THEMES] || SITUATION_THEMES.clear;
  const isHigh = severity === 'high';
  const size = isHigh ? 40 : 32;
  const glowShadow = isHigh 
    ? `0 0 30px ${theme.color}, 0 0 60px ${theme.color}40` 
    : `0 0 20px ${theme.color}80`;
  
  const iconMarkup = renderToStaticMarkup(
    <div className="relative flex items-center justify-center">
      <div 
        className="marker-pulse" 
        style={{ 
          backgroundColor: theme.color,
          width: isHigh ? '4.5rem' : '3rem',
          height: isHigh ? '4.5rem' : '3rem',
          animationDuration: isHigh ? '0.8s' : '2s',
          borderColor: theme.color,
          boxShadow: isHigh ? `0 0 40px ${theme.color}60` : 'none'
        }} 
      />
      <div 
        className={`marker-pin bg-slate-900 border-2 ${isHigh ? 'w-12 h-12' : 'w-8 h-8'}`}
        style={{ 
          borderColor: theme.color, 
          color: theme.color, 
          borderWidth: isHigh ? '3px' : '2px',
          boxShadow: glowShadow
        }}
      >
        {type === 'accident' && <AlertTriangle size={isHigh ? 22 : 14} />}
        {type === 'flood' && <Droplets size={isHigh ? 22 : 14} />}
        {type === 'blocked' && <Construction size={isHigh ? 22 : 14} />}
        {type === 'congestion' && <TrafficCone size={isHigh ? 22 : 14} />}
        {type === 'clear' && <Compass size={isHigh ? 22 : 14} />}
      </div>
    </div>
  );

  return L.divIcon({
    html: iconMarkup,
    className: 'custom-icon',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

function MapController({ situations }: { situations: LocationData[] }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(BANGALORE_BOUNDS);
    
    if (situations.length > 0) {
      const markers = [
        LOCATIONS.silk_board,
        LOCATIONS.hebbal,
        ...situations.map(s => s.coordinates)
      ];
      const bounds = L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, situations]);
  return null;
}

export default function MapView({ situations, onMarkerClick, accessibilityMode }: MapViewProps) {
  return (
    <div className="w-full h-full relative group">
      <MapContainer 
        center={LOCATIONS.mg_road} 
        zoom={13} 
        scrollWheelZoom={true}
        className="z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        <MapController situations={situations} />

        {situations.map((sit) => (
          <Marker 
            key={sit.id} 
            position={sit.coordinates} 
            icon={createCustomIcon(sit.type, sit.severity)}
            eventHandlers={{
              click: () => onMarkerClick(sit)
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <h3 className="font-bold capitalize text-slate-900">{sit.type}</h3>
                <p className="text-xs text-slate-600">{sit.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Start/End Markers Simulation */}
        <Marker 
          position={LOCATIONS.silk_board} 
          icon={L.divIcon({ 
            html: `
              <div class="relative flex items-center justify-center">
                <div class="marker-pulse" style="background-color: #06b6d4; width: 2.5rem; height: 2.5rem;"></div>
                <div class="marker-pin bg-slate-900 border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                  <div class="w-2.5 h-2.5 bg-cyan-400 rounded-full"></div>
                </div>
              </div>
            `,
            className: 'custom-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })}
        />
        <Marker 
          position={LOCATIONS.hebbal} 
          icon={L.divIcon({ 
            html: `
              <div class="relative flex items-center justify-center">
                <div class="marker-pulse" style="background-color: #f43f5e; width: 2.5rem; height: 2.5rem;"></div>
                <div class="marker-pin bg-slate-900 border-2 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)]">
                  <div class="w-2.5 h-2.5 bg-rose-400 rounded-full"></div>
                </div>
              </div>
            `,
            className: 'custom-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })}
        />
      </MapContainer>
      
      {/* HUD Elements Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      </div>
    </div>
  );
}
