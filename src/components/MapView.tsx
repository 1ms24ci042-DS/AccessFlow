import { useEffect, useState, useRef } from 'react';
import { LocationData, SITUATION_THEMES } from '../types';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlertTriangle, Droplets, Construction, TrafficCone, Compass } from 'lucide-react';

interface MapViewProps {
  situations: LocationData[];
  onMarkerClick: (loc: LocationData) => void;
  accessibilityMode: boolean;
  isLightMode?: boolean;
  showTraffic?: boolean;
  sourceCoords?: [number, number];
  destCoords?: [number, number];
}

const getSvgString = (type: string, isHigh: boolean) => {
  const theme = SITUATION_THEMES[type as keyof typeof SITUATION_THEMES] || SITUATION_THEMES.clear;
  const color = theme.color;
  
  // Create a minimal SVG for the marker
  let svgPath = '';
  if (type === 'accident') {
    svgPath = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
  } else if (type === 'flood') {
    svgPath = '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>';
  } else if (type === 'blocked') {
    svgPath = '<path d="M5.5 8.5H9a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 0 3 4.5v15A2.5 2.5 0 0 0 5.5 22H9a2 2 0 0 0 2-2v-2.5a2 2 0 0 0-2-2H5.5"/><path d="M15.5 8.5H19a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3.5A2.5 2.5 0 0 0 13 4.5v15a2.5 2.5 0 0 0 2.5 2.5H19a2 2 0 0 0 2-2v-2.5a2 2 0 0 0-2-2h-3.5"/>';
  } else if (type === 'congestion') {
    svgPath = '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>';
  } else {
    svgPath = '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>';
  }
  
  return `data:image/svg+xml;charset=UTF-8,` + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#0f172a" stroke="${color}" stroke-width="2" />
      <g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(4,4)">
        ${svgPath}
      </g>
    </svg>
  `);
};

export default function MapView({ situations, onMarkerClick, accessibilityMode, isLightMode, showTraffic, sourceCoords, destCoords }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const sourceRef = useRef<google.maps.Marker | null>(null);
  const destRef = useRef<google.maps.Marker | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Check if google maps is loaded
    const initMap = setInterval(() => {
      if (window.google && window.google.maps) {
        clearInterval(initMap);
        
        const gMap = new window.google.maps.Map(mapRef.current!, {
          center: { lat: 12.9716, lng: 77.5946 },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          backgroundColor: '#0f172a',
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
          },
        });

        const dRenderer = new window.google.maps.DirectionsRenderer({
          map: gMap,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 4 }
        });
        setDirectionsRenderer(dRenderer);

        const trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayerRef.current = trafficLayer;

        setMap(gMap);
      }
    }, 100);

    return () => clearInterval(initMap);
  }, []); // Only run once for initialization

  // Update light/dark mode map type url and opacity
  useEffect(() => {
    if (map && window.google) {
      if (trafficLayerRef.current) {
        if (showTraffic) {
          trafficLayerRef.current.setMap(map);
        } else {
          trafficLayerRef.current.setMap(null);
        }
      }

      const darkStyles = [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
        { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
        { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
        { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
        { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
        { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
      ];

      if (!isLightMode) {
        map.setOptions({ styles: darkStyles, mapTypeId: 'roadmap' });
      } else {
        map.setOptions({ styles: [], mapTypeId: 'roadmap' });
      }
    }
  }, [isLightMode, showTraffic, map]);

  // Handle Markers
  useEffect(() => {
    if (!map || !window.google) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const displaySituations = accessibilityMode 
      ? situations.filter(s => s.severity !== 'low') 
      : situations;

    displaySituations.forEach(sit => {
      const marker = new window.google.maps.Marker({
        position: { lat: sit.coordinates[0], lng: sit.coordinates[1] },
        map: map,
        icon: {
          url: getSvgString(sit.type, sit.severity === 'high'),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
        },
        title: sit.type
      });

      marker.addListener('click', () => {
        onMarkerClick(sit);
      });

      markersRef.current.push(marker);
    });

  }, [situations, accessibilityMode, map]);

  // Handle Source and Dest and Route
  useEffect(() => {
    if (!map || !window.google) return;

    if (sourceRef.current) sourceRef.current.setMap(null);
    if (destRef.current) destRef.current.setMap(null);
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] } as any);

    const makeDotIcon = (color: string) => ({
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 6
    });

    if (sourceCoords) {
      sourceRef.current = new window.google.maps.Marker({
        position: { lat: sourceCoords[0], lng: sourceCoords[1] },
        map,
        icon: makeDotIcon('#06b6d4'),
        zIndex: 999
      });
    }

    if (destCoords) {
      destRef.current = new window.google.maps.Marker({
        position: { lat: destCoords[0], lng: destCoords[1] },
        map,
        icon: makeDotIcon('#f43f5e'),
        zIndex: 999
      });
    }

    if (sourceCoords && destCoords) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: sourceCoords[0], lng: sourceCoords[1] });
      bounds.extend({ lat: destCoords[0], lng: destCoords[1] });
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });

      // Fetch route from Google Directions API
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route({
        origin: { lat: sourceCoords[0], lng: sourceCoords[1] },
        destination: { lat: destCoords[0], lng: destCoords[1] },
        travelMode: window.google.maps.TravelMode.DRIVING 
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && directionsRenderer) {
          directionsRenderer.setDirections(result);
        }
      });

    } else if (sourceCoords) {
      map.panTo({ lat: sourceCoords[0], lng: sourceCoords[1] });
      map.setZoom(14);
    }
  }, [sourceCoords, destCoords, map, directionsRenderer]);

  return (
    <div className="w-full h-full relative group bg-slate-900">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
