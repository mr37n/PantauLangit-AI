export interface HistoryRecord {
  id: string;
  timestamp: Date;
  aqi: number;
  status: string;
  visibilityIndex: number;
  pm25: number;
  location: { lat: number; lng: number };
  address: string;
  // Additional fields for comparison
  pm10?: number;
  humidity?: number;
  temp?: number;
}

export interface AnalysisResult {
  visibilityIndex: number;
  estimatedAQI: number;
  aqiUtama?: number; // Alias requested by user
  dominantParticulate: string;
  confidence: number;
  description: string;
  status: string;
  lokasi?: string;
  rekomendasi?: string;
  visualisasiSekitar?: {
    radius_1km: string;
    radius_5km: string;
    radius_10km: string;
  };
  weather?: {
    temperature: number;
    windSpeed: number;
    windDirection?: string;
    humidity: number;
    condition: string;
    effectOnPollution: string;
  };
  pollutants: {
    name: string;
    value: number;
    unit: string;
    confidence: number;
    visualCues: string[];
  }[];
}

export interface LocalPollution {
  aqi: number;
  city: string;
  dominant: string;
  time: string;
}
