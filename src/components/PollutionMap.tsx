import React, { useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker
} from '@vis.gl/react-google-maps';
import { Wind, AlertTriangle, Info, CheckCircle2, Cloud, Sun, CloudRain, CloudLightning, Droplets } from 'lucide-react';
import { cn } from '../lib/utils';
import { HistoryRecord } from '../types';

interface WeatherData {
  temp: string | number;
  humidity: string | number;
  wind: string | number;
  uv: string | number;
  condition: string;
}

interface AnalysisData {
  airQuality: string;
  composition: { name: string; value: string; }[];
  recommendation?: string;
}

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
  historyData?: HistoryRecord[];
  weatherData?: WeatherData | null;
  analysisData?: AnalysisData | null;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
}> = ({ apiKey, userLocation, historyData = [], weatherData, analysisData, onLocationChange }) => {
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
          onCenterChanged={(ev) => {
            if (onLocationChange && ev.detail.center) {
              onLocationChange(ev.detail.center);
            }
          }}
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

          {/* WEATHER FORECAST MARKER */}
          {userLocation && weatherData && (
            <AdvancedMarker position={{ lat: userLocation.lat + 0.015, lng: userLocation.lng + 0.015 }}>
               <WeatherMarker weather={weatherData} />
            </AdvancedMarker>
          )}

          {/* POLLUTION MARKERS */}
          {allMarkers.map((marker) => (
            <AdvancedMarker 
              key={marker.id} 
              position={{ lat: marker.lat!, lng: marker.lng! }}
            >
              <AqiMarker aqi={marker.aqi} label={marker.label} />
            </AdvancedMarker>
          ))}
        </Map>
        
        {/* AI POLLUTION STATUS OVERLAY */}
        {analysisData && (
          <div className="absolute bottom-10 left-10 z-10 glass-dark border border-white/10 p-5 rounded-[2rem] shadow-2xl max-w-xs overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-1000">
             <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                   <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <Wind className="w-4 h-4" />
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Scanning Result</p>
                      <h4 className="text-xs font-black text-white mt-1">Air Integrity: {analysisData.airQuality}</h4>
                   </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                   {analysisData.composition.slice(0, 3).map((comp, i) => (
                     <div key={i} className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">{comp.name}:</span>
                        <span className="text-[10px] font-black text-white">{comp.value}</span>
                     </div>
                   ))}
                </div>
                
                {analysisData.recommendation && (
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic border-t border-white/5 pt-2">
                    "{analysisData.recommendation}"
                  </p>
                )}
             </div>
          </div>
        )}
      </APIProvider>
    </div>
  );
};

// --- MARKER KOMPONEN DENGAN LOGIKA WARNA SAKTI ---
const AqiMarker: React.FC<{ aqi: number; label: string }> = ({ aqi, label }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const config = useMemo(() => {
    if (aqi <= 50) return {
      color: 'bg-emerald-500',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
      icon: CheckCircle2,
      border: 'border-emerald-400/50',
      status: 'Bagus'
    };
    if (aqi <= 100) return {
      color: 'bg-amber-500',
      glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]',
      icon: Info,
      border: 'border-amber-400/50',
      status: 'Moderat'
    };
    if (aqi <= 150) return {
      color: 'bg-orange-500',
      glow: 'shadow-[0_0_12px_rgba(249,115,22,0.5)]',
      icon: AlertTriangle,
      border: 'border-orange-400/50',
      status: 'Tidak Sehat'
    };
    return {
      color: 'bg-rose-600',
      glow: 'shadow-[0_0_20px_rgba(225,29,72,0.8)]',
      icon: Wind,
      border: 'border-rose-400/50',
      status: 'Berbahaya'
    };
  }, [aqi]);

  const Icon = config.icon;

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative flex items-center justify-center p-1.5 rounded-full border transition-all hover:scale-125 cursor-pointer shadow-xl",
        config.color,
        config.glow,
        config.border
      )}
    >
      <Icon className="w-3.5 h-3.5 text-white" />
      
      {/* FUTURISTIC TOOLTIP */}
      <div className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none transition-all duration-300",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}>
        <div className="glass-dark border border-white/10 p-2.5 rounded-xl shadow-2xl min-w-[120px] backdrop-blur-md">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{label}</span>
            <div className="flex items-center justify-between gap-4">
              <span className="text-lg font-black text-white leading-none">{aqi}</span>
              <div className={cn(
                "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter text-white",
                config.color
              )}>
                {config.status}
              </div>
            </div>
            <div className="w-full h-[2px] bg-white/5 rounded-full mt-1 overflow-hidden">
               <div 
                 className={cn("h-full transition-all duration-1000", config.color)} 
                 style={{ width: `${Math.min((aqi / 300) * 100, 100)}%` }}
               />
            </div>
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-navy-950 border-r border-b border-white/10 rotate-45" />
        </div>
      </div>
    </div>
  );
};

// --- WEATHER MARKER COMPONENT ---
const WeatherMarker: React.FC<{ weather: WeatherData }> = ({ weather }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const WeatherIcon = useMemo(() => {
    const cond = weather.condition?.toLowerCase() || '';
    if (cond.includes('clear') || cond.includes('sun')) return Sun;
    if (cond.includes('rain') || cond.includes('drizzle')) return CloudRain;
    if (cond.includes('thunder')) return CloudLightning;
    return Cloud;
  }, [weather.condition]);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center justify-center w-10 h-10 glass-dark rounded-2xl border border-white/20 transition-all hover:scale-110 cursor-pointer shadow-2xl overflow-visible"
    >
      <WeatherIcon className="w-5 h-5 text-blue-400" />
      
      <div className={cn(
        "absolute top-full left-1/2 -translate-x-1/2 mt-3 pointer-events-none transition-all duration-300 z-50",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}>
        <div className="glass-dark border border-white/10 p-3 rounded-2xl shadow-3xl min-w-[140px] backdrop-blur-xl">
           <div className="flex flex-col gap-2">
              <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest text-center">Local Forecast</span>
              <div className="flex items-center justify-center gap-2">
                 <WeatherIcon className="w-4 h-4 text-white" />
                 <span className="text-xs font-black text-white leading-none">{weather.temp}°C</span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
                 <div className="flex flex-col items-center">
                    <Droplets className="w-2.5 h-2.5 text-blue-400 mb-0.5" />
                    <span className="text-[8px] font-bold text-slate-300">{weather.humidity}%</span>
                 </div>
                 <div className="flex flex-col items-center">
                    <Wind className="w-2.5 h-2.5 text-emerald-400 mb-0.5" />
                    <span className="text-[8px] font-bold text-slate-300">{weather.wind}k</span>
                 </div>
              </div>
           </div>
           <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-navy-950 border-l border-t border-white/10 rotate-45" />
        </div>
      </div>
    </div>
  );
};
