import React, { useMemo, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap
} from '@vis.gl/react-google-maps';

import {
  Wind,
  AlertTriangle,
  Info,
  CheckCircle2,
  LocateFixed
} from 'lucide-react';

import { cn } from '../lib/utils';
import { HistoryRecord } from '../types';

/* =========================================================
   DARK FUTURISTIC MAP STYLE
========================================================= */

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#050816' }]
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#050816' }]
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7c93b3' }]
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }]
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#020617' }]
  }
];

/* =========================================================
   TYPES
========================================================= */

interface PollutionData {
  id: string;
  lat: number;
  lng: number;
  aqi: number;
  label: string;
}

/* =========================================================
   MOCK DATA
========================================================= */

const MOCK_POLLUTION_DATA: PollutionData[] = [
  { id: '1', lat: -6.1754, lng: 106.8272, aqi: 45, label: 'Monas' },
  { id: '2', lat: -6.2297, lng: 106.8166, aqi: 120, label: 'Sudirman' },
  { id: '3', lat: -6.1214, lng: 106.7741, aqi: 180, label: 'PIK' },
  { id: '4', lat: -6.2146, lng: 106.8451, aqi: 85, label: 'Manggarai' },
  { id: '5', lat: -6.3644, lng: 106.8286, aqi: 30, label: 'UI Depok' }
];

/* =========================================================
   MAIN COMPONENT
========================================================= */

export const PollutionMap: React.FC<{
  apiKey: string;
  mapId?: string;
  userLocation: { lat: number; lng: number } | null;
  targetLocation: { lat: number; lng: number } | null;
  historyData?: HistoryRecord[];
  onLocationChange?: (location: { lat: number; lng: number }) => void;
  onRecenter?: () => void;
}> = ({
  apiKey,
  mapId,
  userLocation,
  targetLocation,
  historyData = [],
  onLocationChange,
  onRecenter
}) => {

  const center = useMemo(
    () => targetLocation || { lat: -6.2, lng: 106.8166 },
    [targetLocation]
  );

  const allMarkers = useMemo(() => {

    const historicalMarkers = historyData
      .map((log, idx) => ({
        id: `history-${idx}`,
        lat: log.location?.lat,
        lng: log.location?.lng,
        aqi: log.aqi,
        label: log.address || 'User Scan'
      }))
      .filter((m) => m.lat && m.lng);

    return [...MOCK_POLLUTION_DATA, ...historicalMarkers];

  }, [historyData]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-[2.5rem]">

      <APIProvider apiKey={apiKey}>

        <Map
          defaultCenter={center}
          defaultZoom={11}
          mapId={mapId || "90f8735696b42b87"}
          disableDefaultUI={true}
          gestureHandling="greedy"
          styles={DARK_MAP_STYLES}
          className="w-full h-full"
          onCenterChanged={(ev) => {
            if (onLocationChange && ev.detail.center) {
              onLocationChange(ev.detail.center);
            }
          }}
        >

          {/* AIR QUALITY OVERLAY */}
          <AirQualityLayer apiKey={apiKey} />

          {/* USER LOCATION */}
          {userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="relative flex items-center justify-center">
                <div className="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping"></div>
                <div className="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-pulse"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(37,99,235,0.8)] z-10"></div>
              </div>
            </AdvancedMarker>
          )}

          {/* AQI MARKERS */}
          {allMarkers.map((marker) => (
            <AdvancedMarker
              key={marker.id}
              position={{
                lat: marker.lat!,
                lng: marker.lng!
              }}
            >
              <AqiMarker
                aqi={marker.aqi}
              />
            </AdvancedMarker>
          ))}

        </Map>

        {/* RECENTER BUTTON */}
        <button
          onClick={() => onRecenter?.()}
          className="absolute top-5 right-5 z-20
          w-12 h-12 rounded-2xl
          bg-blue-600 hover:bg-blue-700
          transition-all shadow-2xl
          flex items-center justify-center"
        >
          <LocateFixed className="w-5 h-5 text-white" />
        </button>

      </APIProvider>
    </div>
  );
};

/* =========================================================
   AIR QUALITY LAYER
========================================================= */

const AirQualityLayer: React.FC<{
  apiKey: string;
}> = ({ apiKey }) => {

  const map = useMap();
  const overlayRef = useRef<google.maps.ImageMapType | null>(null);

  useEffect(() => {

    if (!map || !window.google) return;

    // Prevent duplicate overlay
    if (overlayRef.current) return;

    const overlay = new google.maps.ImageMapType({

      getTileUrl: (coord, zoom) => {
        return `https://airquality.googleapis.com/v1/mapTypes/UAQI_RED_GREEN/heatmapTiles/${zoom}/${coord.x}/${coord.y}?key=${apiKey}`;
      },

      tileSize: new google.maps.Size(256, 256),

      opacity: 0.88,

      name: 'Google Air Quality'

    });

    overlayRef.current = overlay;

    map.overlayMapTypes.push(overlay);

    return () => {

      if (!map || !overlayRef.current) return;

      const overlays = map.overlayMapTypes;

      for (let i = overlays.getLength() - 1; i >= 0; i--) {

        const layer = overlays.getAt(i);

        if (
          layer &&
          (layer as google.maps.ImageMapType).name ===
            'Google Air Quality'
        ) {
          overlays.removeAt(i);
        }
      }

      overlayRef.current = null;
    };

  }, [map, apiKey]);

  return null;
};

/* =========================================================
   AQI MARKER
========================================================= */

const AqiMarker: React.FC<{
  aqi: number;
}> = ({ aqi }) => {

  const config = useMemo(() => {

    if (aqi <= 50) {
      return {
        color: 'bg-emerald-500',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.7)]',
        icon: CheckCircle2
      };
    }

    if (aqi <= 100) {
      return {
        color: 'bg-yellow-500',
        glow: 'shadow-[0_0_20px_rgba(234,179,8,0.7)]',
        icon: Info
      };
    }

    if (aqi <= 150) {
      return {
        color: 'bg-orange-500',
        glow: 'shadow-[0_0_20px_rgba(249,115,22,0.7)]',
        icon: AlertTriangle
      };
    }

    return {
      color: 'bg-red-600',
      glow: 'shadow-[0_0_25px_rgba(220,38,38,0.9)]',
      icon: Wind
    };

  }, [aqi]);

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full border border-white/20',
        'flex items-center justify-center',
        'backdrop-blur-xl',
        'transition-all duration-300 hover:scale-125',
        config.color,
        config.glow
      )}
    >
      <Icon className="w-4 h-4 text-white" />
    </div>
  );
};