import React, { useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  useAdvancedMarkerRef
} from '@vis.gl/react-google-maps';
import { Wind, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

// --- MAP STYLING (DARK MODE FUTURISTIK) ---
const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#020617" }],
  },
];

interface PollutionData {
  id: string;
  lat: number;
  lng: number;
  aqi: number;
  label: string;
}

// --- MOCK MARKERS DATA (Around Jakarta) ---
const MOCK_POLLUTION_DATA: PollutionData[] = [
  { id: '1', lat: -6.1754, lng: 106.8272, aqi: 45, label: 'Monas' },
  { id: '2', lat: -6.2297, lng: 106.8166, aqi: 120, label: 'Sudirman' },
  { id: '3', lat: -6.1214, lng: 106.7741, aqi: 180, label: 'PIK' },
  { id: '4', lat: -6.2146, lng: 106.8451, aqi: 85, label: 'Manggarai' },
  { id: '5', lat: -6.3644, lng: 106.8286, aqi: 30, label: 'UI Depok' },
  { id: '6', lat: -6.1805, lng: 106.9278, aqi: 155, label: 'Cakung' },
  { id: '7', lat: -6.2415, lng: 106.7024, aqi: 95, label: 'Ciledug' },
  { id: '8', lat: -6.1674, lng: 106.7637, aqi: 55, label: 'Kebon Jeruk' },
];

export const PollutionMap: React.FC<{
  apiKey: string;
  userLocation: { lat: number; lng: number } | null;
  historyData?: any[];
}> = ({ apiKey, userLocation, historyData = [] }) => {
  const center = useMemo(() => userLocation || { lat: -6.2, lng: 106.8166 }, [userLocation]);

  // Combine mock data with real history for better visualization
  const allMarkers = useMemo(() => {
    const historicalMarkers = historyData.map((log, idx) => ({
      id: `history-${idx}`,
      lat: log.location?.lat,
      lng: log.location?.lng,
      aqi: log.aqi,
      label: log.address || 'User Scan'
    })).filter(m => m.lat && m.lng);
    
    return [...MOCK_POLLUTION_DATA, ...historicalMarkers];
  }, [historyData]);

  return (
    <div className="w-full h-full relative">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={12}
          mapId="CAKRAWALA_DARK_MAP"
          gestureHandling="greedy"
          disableDefaultUI={true}
          styles={DARK_MAP_STYLES}
          className="w-full h-full rounded-[2.5rem]"
        >
          {/* USER LOCATION MARKER WITH RADAR PULSE */}
          {userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="relative flex items-center justify-center">
                <div className="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping"></div>
                <div className="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-pulse"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(37,99,235,0.8)] z-10"></div>
              </div>
            </AdvancedMarker>
          )}

          {/* POLLUTION MARKERS */}
          {allMarkers.map((marker) => (
            <AdvancedMarker 
              key={marker.id} 
              position={{ lat: marker.lat, lng: marker.lng }}
            >
              <AqiMarker aqi={marker.aqi} />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
};

// --- MARKER KOMPONEN DENGAN LOGIKA WARNA SAKTI ---
const AqiMarker: React.FC<{ aqi: number }> = ({ aqi }) => {
  const config = useMemo(() => {
    if (aqi <= 50) return {
      color: 'bg-emerald-500',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
      icon: CheckCircle2,
      border: 'border-emerald-400/50'
    };
    if (aqi <= 100) return {
      color: 'bg-amber-500',
      glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]',
      icon: Info,
      border: 'border-amber-400/50'
    };
    if (aqi <= 150) return {
      color: 'bg-orange-500',
      glow: 'shadow-[0_0_12px_rgba(249,115,22,0.5)]',
      icon: AlertTriangle,
      border: 'border-orange-400/50'
    };
    return {
      color: 'bg-rose-600',
      glow: 'shadow-[0_0_20px_rgba(225,29,72,0.8)]',
      icon: Wind,
      border: 'border-rose-400/50'
    };
  }, [aqi]);

  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center justify-center p-1.5 rounded-full border transition-all hover:scale-125 cursor-pointer shadow-xl",
      config.color,
      config.glow,
      config.border
    )}>
      <Icon className="w-3.5 h-3.5 text-white" />
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-navy-950 px-2 py-0.5 rounded-md text-[8px] font-black text-white border border-white/10">
        AQI: {aqi}
      </div>
    </div>
  );
};
