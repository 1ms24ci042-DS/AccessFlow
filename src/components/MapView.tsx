import { useEffect, useState } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  useMap, 
  Pin,
  InfoWindow,
  useAdvancedMarkerRef
} from '@vis.gl/react-google-maps';
import { BANGALORE_BOUNDS, LOCATIONS, LocationData, SITUATION_THEMES } from '../types';
import { 
  AlertTriangle, 
  Droplets, 
  Construction, 
  TrafficCone, 
  Compass, 
  ShieldAlert,
  Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MapViewProps {
  situations: LocationData[];
  onMarkerClick: (loc: LocationData) => void;
  accessibilityMode: boolean;
}

const API_KEY = 'AIzaSyCPuDoVRDfUL_XDDDgQEDaoHDaJvohWMUs';
const hasValidKey = true;

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#334155" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] }
];

const toLatLng = (coords: [number, number]) => ({
  lat: coords[0],
  lng: coords[1]
});

function MapController({ situations }: { situations: LocationData[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;

    // Bangalore bounds constraint
    const bounds = new google.maps.LatLngBounds(
      toLatLng(BANGALORE_BOUNDS[0]),
      toLatLng(BANGALORE_BOUNDS[1])
    );

    if (situations.length > 0) {
      const allPoints = [
        toLatLng(LOCATIONS.silk_board),
        toLatLng(LOCATIONS.hebbal),
        ...situations.map(s => toLatLng(s.coordinates))
      ];
      const fitBounds = new google.maps.LatLngBounds();
      allPoints.forEach(p => fitBounds.extend(p));
      map.fitBounds(fitBounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else {
       map.setCenter(toLatLng(LOCATIONS.mg_road));
       map.setZoom(13);
    }
  }, [map, situations]);

  return null;
}

const HazardMarker = ({ sit, onClick }: { sit: LocationData, onClick: () => void }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoWindowShown, setInfoWindowShown] = useState(false);
  const theme = SITUATION_THEMES[sit.type as keyof typeof SITUATION_THEMES] || SITUATION_THEMES.clear;
  const isHigh = sit.severity === 'high';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={toLatLng(sit.coordinates)}
        onClick={() => {
          setInfoWindowShown(true);
          onClick();
        }}
      >
        <div className="relative flex items-center justify-center translate-y-[-50%]">
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
            className={`marker-pin bg-slate-900 border-2 rounded-full flex items-center justify-center ${isHigh ? 'w-12 h-12' : 'w-8 h-8'}`}
            style={{ 
              borderColor: theme.color, 
              color: theme.color, 
              borderWidth: isHigh ? '3px' : '2px',
              boxShadow: isHigh ? `0 0 30px ${theme.color}, 0 0 60px ${theme.color}40` : `0 0 20px ${theme.color}80`
            }}
          >
            {sit.type === 'accident' && <AlertTriangle size={isHigh ? 22 : 14} />}
            {sit.type === 'flood' && <Droplets size={isHigh ? 22 : 14} />}
            {sit.type === 'blocked' && <Construction size={isHigh ? 22 : 14} />}
            {sit.type === 'congestion' && <TrafficCone size={isHigh ? 22 : 14} />}
            {sit.type === 'clear' && <Compass size={isHigh ? 22 : 14} />}
          </div>
        </div>
      </AdvancedMarker>
      {infoWindowShown && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoWindowShown(false)}>
           <div className="p-1 min-w-[120px]">
              <h3 className="font-bold capitalize text-slate-900 flex items-center gap-2">
                <ShieldAlert size={14} className={isHigh ? 'text-red-500' : 'text-amber-500'} />
                {sit.type}
              </h3>
              <p className="text-xs text-slate-600 mt-1">{sit.description}</p>
              <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Impact: {sit.severity}
              </div>
            </div>
        </InfoWindow>
      )}
    </>
  );
};

export default function MapView({ situations, onMarkerClick, accessibilityMode }: MapViewProps) {
  if (!hasValidKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-card p-8 text-center space-y-6 border-cyan-500/30"
        >
          <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/40">
            <ShieldAlert className="text-cyan-400" size={32} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-white">Google Maps API Key Required</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            To enable the interactive surveillance map, you need to provide a Google Maps Platform API key.
          </p>
          
          <div className="text-left space-y-4 bg-slate-900/50 p-4 rounded-xl border border-white/5">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
              <p className="text-xs text-slate-300">
                Get an API key from <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener" className="text-cyan-400 hover:underline">Google Cloud Console</a>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
              <p className="text-xs text-slate-300">
                Open <strong>Settings</strong> (⚙️ icon) → <strong>Secrets</strong>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
              <p className="text-xs text-slate-300">
                Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name and paste your key as the value.
              </p>
            </div>
          </div>
          
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            The app will rebuild automatically once the key is added.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={toLatLng(LOCATIONS.mg_road)}
          defaultZoom={13}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          styles={DARK_MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          colorScheme={accessibilityMode ? 'light' : 'dark'}
        >
          <MapController situations={situations} />

          {situations.map((sit) => (
            <HazardMarker key={sit.id} sit={sit} onClick={() => onMarkerClick(sit)} />
          ))}

          {/* Source Marker */}
          <AdvancedMarker position={toLatLng(LOCATIONS.silk_board)}>
             <div className="relative flex items-center justify-center translate-y-[-50%]">
              <div className="marker-pulse" style={{ backgroundColor: '#06b6d4', width: '2.5rem', height: '2.5rem' }}></div>
              <div className="marker-pin bg-slate-900 border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] w-8 h-8 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full"></div>
              </div>
            </div>
          </AdvancedMarker>

          {/* Destination Marker */}
          <AdvancedMarker position={toLatLng(LOCATIONS.hebbal)}>
            <div className="relative flex items-center justify-center translate-y-[-50%]">
              <div className="marker-pulse" style={{ backgroundColor: '#f43f5e', width: '2.5rem', height: '2.5rem' }}></div>
              <div className="marker-pin bg-slate-900 border-2 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)] w-8 h-8 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-rose-400 rounded-full"></div>
              </div>
            </div>
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  );
}
