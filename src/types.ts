export interface HistoryRecord {
  id: string;
  timestamp: Date;
  aqi: number;
  status: string;
  visibilityIndex: number;
  pm25: number;
  location?: { lat: number; lng: number };
  address?: string;
  // Additional fields for comparison
  pm10?: number;
  humidity?: number;
  temp?: number;
}

export interface AnalysisResult {
  visibilityIndex: number;
  estimatedAQI: number;
  dominantParticulate: string;
  confidence: number;
  description: string;
  status: string;
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
