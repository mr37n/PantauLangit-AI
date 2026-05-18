import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Camera, Map as MapIcon, History, FileText, 
  AlertTriangle, CheckCircle2, Info, ChevronRight, Maximize2,
  Navigation, Wind, Droplets, Thermometer, Cloud, X, Sliders, Cpu,
  Download, RefreshCw, BarChart3, Settings, Moon, Sun
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast, Toaster } from "react-hot-toast";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import { Logo } from "./components/Logo";
import { saveAQIRecord, getHistory, testFirestoreConnection } from "./lib/firebase";
import { saveLocalAQI, getLocalAQI, clearLocalAQI } from "./lib/storage";
import { saveHistoryToCache, getHistoryFromCache, saveHistoryRecordToCache } from "./lib/cache";
import { cn, getAQIColor, getAQITextColor, getAQIStatus } from "./lib/utils";
import { HistoryRecord, AnalysisResult } from "./types";

import { PollutionMap } from "./components/PollutionMap";
import { WeatherForecast } from "./components/WeatherForecast";

// Remove local types as they are now in types.ts

// Maps Configuration
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const hasValidMapsKey = Boolean(MAPS_API_KEY) && MAPS_API_KEY !== "MY_GOOGLE_MAPS_KEY";

export default function App() {
  const [activeTab, setActiveTab] = useState<"analysis" | "history" | "map" | "settings">("analysis");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("Jakarta Cluster");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [realTimeHistory, setRealTimeHistory] = useState<HistoryRecord[]>([]);
  const [weatherData, setWeatherData] = useState<{
    temp: number;
    humidity: number;
    wind: number;
    uv: number;
    condition: string;
  } | null>(null);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [calibration, setCalibration] = useState<{
    pm25Offset: number;
    pm10Offset: number;
    tempOffset: number;
    humidityOffset: number;
  }>({
    pm25Offset: 0,
    pm10Offset: 0,
    tempOffset: 0,
    humidityOffset: 0
  });
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Periodic Auto-Focus Trigger
  useEffect(() => {
    let focusInterval: ReturnType<typeof setInterval>;
    
    if (activeTab === "analysis" && isCapturing && streamRef.current) {
      focusInterval = setInterval(async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (track && 'applyConstraints' in track) {
          try {
            const capabilities = track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] };
            if (capabilities.focusMode) {
              setIsFocusing(true);
              await track.applyConstraints({
                advanced: [{ focusMode: 'continuous' }]
              } as unknown as MediaTrackConstraints);
              setTimeout(() => setIsFocusing(false), 1500);
            }
          } catch (e) {
            console.warn("Auto-focus application failed:", e);
          }
        }
      }, 8000); 
    }

    return () => clearInterval(focusInterval);
  }, [activeTab, isCapturing]);

  // Online/Offline Listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load History
  const loadHistory = useCallback(async () => {
    try {
      // 1. Try loading from IndexedDB Cache first (FCP improvement)
      const cachedData = await getHistoryFromCache();
      if (cachedData.length > 0) {
        setHistory(cachedData);
      }

      // 2. Fetch from Firebase
      const firebaseData = await getHistory();
      
      // 3. Save new data to cache
      if (firebaseData.length > 0) {
        await saveHistoryToCache(firebaseData);
      }

      const localData = getLocalAQI();
      
      // Merge and deduplicate by ID, then sort by timestamp
      const combined = [...firebaseData, ...localData, ...cachedData].sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      // Simple deduplication (prefer Firebase IDs over local)
      const seen = new Set();
      const unique = combined.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      setHistory(unique);
    } catch (err) {
      console.warn("Firebase fetch failed, falling back to cache:", err);
      const cachedData = await getHistoryFromCache();
      const localData = getLocalAQI();
      
      const combined = [...cachedData, ...localData].sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      const seen = new Set();
      const unique = combined.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      setHistory(unique);
    }
  }, []);

  const fetchLocationName = useCallback(async (lat: number, lng: number) => {
    try {
      // Try Google Maps Geocoding if key is valid
      if (hasValidMapsKey) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`);
        const data = await res.json();
        if (data.results && data.results[0]) {
          // Extract a shorter name (e.g., city or neighborhood)
          const cityComponent = data.results[0].address_components.find((c: { types: string[] }) => 
            c.types.includes("locality") || c.types.includes("administrative_area_level_2")
          );
          setLocationName(cityComponent?.long_name || "Detected Sector");
          return;
        }
      }
      
      // Fallback to OpenStreetMap/Nominatim (Free, no key required)
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
      const data = await res.json();
      if (data.display_name) {
        const parts = data.display_name.split(',');
        setLocationName(parts[0] + " Cluster");
      } else {
        setLocationName("Sector Alpha");
      }
    } catch (err) {
      console.warn("Geocoding failed:", err);
      setLocationName("Unknown Cluster");
    }
  }, []);

  const fetchWeatherData = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,uv_index`);
      const data = await res.json();
      if (data.current) {
        const descriptions: Record<number, string> = {
          0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
          45: "Fog", 48: "Rime Fog", 51: "Drizzle", 61: "Rain", 95: "Thunderstorm"
        };
        setWeatherData({
          temp: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          wind: data.current.wind_speed_10m,
          uv: data.current.uv_index,
          condition: descriptions[data.current.weather_code as number] || "Clear"
        });
      }
    } catch (err) {
      console.error("OpenMeteo fetch failed:", err);
    }
  }, []);

  // Update real-time history for graph (last 5 minutes)
  useEffect(() => {
    const updateRealTimeData = () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const filtered = history.filter(item => {
        const timestamp = item.timestamp instanceof Date ? item.timestamp.getTime() : new Date(item.timestamp).getTime();
        return timestamp > fiveMinutesAgo;
      }).sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
      setRealTimeHistory(filtered);
    };

    updateRealTimeData();
    const interval = setInterval(updateRealTimeData, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [history]);

  const historyAqiSum = history.reduce((a, b) => a + b.aqi, 0);
  const historyAqiMean = history.length > 0 ? (historyAqiSum / history.length).toFixed(0) : "--";

  // Google Maps Auth Failure Detection
  useEffect(() => {
    (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
      setMapError(true);
      toast.error("Google Maps API Error: API tidak diaktifkan");
    };
    return () => {
      delete (window as Window & { gm_authFailure?: () => void }).gm_authFailure;
    };
  }, []);

  // Auth State
  useEffect(() => {
    testFirestoreConnection();
    const init = async () => {
      await loadHistory();
    };
    init();
  }, [loadHistory]);

  // Location Watcher
  useEffect(() => {
    let watcherId: number;
    if (navigator.geolocation) {
      watcherId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDeviceLocation(newPos);
          
          // Initial set for map location if not set
          setLocation(prev => {
            if (!prev) {
              fetchWeatherData(newPos.lat, newPos.lng);
              fetchLocationName(newPos.lat, newPos.lng);
              return newPos;
            }
            return prev;
          });
        },
        (error) => {
          console.warn("Geolocation watch error:", error);
          if (error.code === 1) toast.error("Izin lokasi ditolak");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
    return () => {
      if (watcherId !== undefined) navigator.geolocation.clearWatch(watcherId);
    };
  }, [fetchWeatherData, fetchLocationName]);


  // Notification logic for Poor AQI
  useEffect(() => {
    if (analysis && analysis.estimatedAQI > 100) {
       toast(() => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-bold text-red-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Kualitas Udara Buruk!</span>
          </div>
          <p className="text-xs text-slate-600">
            AQI saat ini mencapai {analysis.estimatedAQI}. Harap gunakan masker jika beraktivitas di luar.
          </p>
        </div>
      ), { duration: 5000, position: 'top-right' });
    }
  }, [analysis]);

  // Reset camera when unmounting or switching tabs
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Attach stream when video element is ready
  useEffect(() => {
    if (isCapturing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [isCapturing]);

  // Camera Management
  const startCamera = async () => {
    setIsInitializing(true);
    setRecordedVideoUrl(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Browser Anda tidak mendukung akses kamera.");
      setIsInitializing(false);
      return;
    }

    try {
      // Successively try different constraints with focus support
      const autofocusConstraints = { focusMode: "continuous" } as unknown as MediaTrackConstraintSet;
      const constraints = [
        { 
          video: { 
            facingMode: { ideal: "environment" }, 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
            advanced: [autofocusConstraints]
          } 
        },
        { 
          video: { 
            facingMode: { ideal: "environment" }, 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            advanced: [autofocusConstraints]
          } 
        },
        { video: { facingMode: "environment", advanced: [autofocusConstraints] } },
        { video: true }
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (stream) break;
        } catch (e) {
          lastError = e;
          console.warn("Retrying camera with different constraints...", e);
        }
      }

      if (!stream) throw lastError || new Error("No stream acquired");

      streamRef.current = stream;
      setIsCapturing(true);
    } catch (err) {
      console.error("Camera Final Error:", err);
      if (err instanceof Error) {
        const name = err.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          toast.error("Izin ditolak. Silakan izinkan kamera di browser Anda.");
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          toast.error("Kamera tidak ditemukan.");
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          toast.error("Kamera sedang digunakan oleh aplikasi lain.");
        } else {
          toast.error(`Kamera error: ${err.message}`);
        }
      } else {
        toast.error("Gagal mengakses kamera.");
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    setAnalysis(null);
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setIsRecording(false);
      toast.success("Rekaman video selesai.");
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // Analysis Logic
  const analyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsAnalyzing(true);
    // Simulation: Multi-stage neural processing
    await new Promise(resolve => setTimeout(resolve, 800)); // Pattern recognition
    await new Promise(resolve => setTimeout(resolve, 1200)); // Climate model alignment

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

    try {
      const res = await fetch("/api/analyze-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          location: location
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }
      
      setAnalysis(data);

      if (data.estimatedAQI) {
        const recordData: HistoryRecord = {
          id: `local-${Date.now()}`,
          aqi: data.estimatedAQI,
          status: data.status,
          visibilityIndex: data.visibilityIndex,
          pm25: data.estimatedAQI * 0.8, // Approximation
          location: location || { lat: -6.2, lng: 106.8 },
          address: "Jakarta Pusat",
          timestamp: new Date()
        };

        // Save to Firebase (Optional, don't fail the whole flow if it fails)
        try {
          await saveAQIRecord(recordData);
        } catch (firebaseErr) {
          console.warn("Firestore save failed but continuing:", firebaseErr);
          toast("Gagal menyimpan ke riwayat cloud, menggunakan mode lokal.", { icon: "ℹ️" });
        }
        
        // Save to Local Storage
        saveLocalAQI(recordData);

        // Save to IndexedDB Cache (Offline Feature)
        try {
          await saveHistoryRecordToCache(recordData);
        } catch (cacheErr) {
          console.warn("Cache save failed:", cacheErr);
        }

        loadHistory();
      }
    } catch (err) {
      console.error("Analysis Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Gagal menganalisis gambar";
      toast.error(`Analisis Gagal: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Export PDF
  const exportPDF = async () => {
    const element = document.getElementById("report-area");
    if (!element) return;
    try {
      const dataUrl = await toPng(element, { quality: 0.95, cacheBust: true });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));
      const pdfHeight = (img.height * pdfWidth) / img.width;
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PantauLangit_AI_Report_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast.error("Gagal mengekspor PDF. Silakan coba lagi.");
    }
  };

  if ((!hasValidMapsKey || mapError) && activeTab === "map") {
    return (
      <div className="flex h-screen w-full bg-slate-950 font-sans text-slate-200 overflow-hidden">
        <div className="m-auto text-center max-w-lg p-10 bg-navy-900 rounded-[3rem] border border-white/5 shadow-2xl flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-blue-500/20">
            <MapIcon className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-2xl font-black mb-4 tracking-tight">Konfigurasi Maps Diperlukan</h2>
          
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-8 w-full">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2 justify-center">
              <AlertTriangle className="w-4 h-4" />
              {mapError ? "Problem Terdeteksi: ApiNotActivatedMapError" : "Menunggu API Key"}
            </p>
            <p className="text-[13px] text-slate-400 leading-relaxed">
              {mapError 
                ? "API Key Anda sudah terpasang, namun layanan 'Maps JavaScript API' belum diaktifkan pada project Google Cloud Anda."
                : "Anda perlu memasukkan VITE_GOOGLE_MAPS_API_KEY di menu Secrets untuk melihat peta polusi."}
            </p>
          </div>

          <div className="w-full space-y-4 text-left">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Langkah Perbaikan</h4>
            <div className="space-y-2">
              <a 
                href="https://console.cloud.google.com/google/maps-apis/api/maps-backend.googleapis.com/overview" 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5 hover:border-blue-500/50 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white group-hover:text-blue-400 px-2">1. Aktifkan API</span>
                  <span className="text-[10px] text-slate-500 px-2">Klik untuk membuka Google Cloud Console</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-transform group-hover:translate-x-1" />
              </a>
              
              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex flex-col gap-2">
                <span className="text-sm font-bold text-white px-2">2. Tekan Tombol "ENABLE"</span>
                <span className="text-[10px] text-slate-500 px-2 leading-relaxed">Pada halaman console, pastikan tombol biru bertuliskan <b>"ENABLE"</b> atau <b>"AKTIFKAN"</b> sudah ditekan.</span>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex flex-col gap-2">
                <span className="text-sm font-bold text-white px-2">3. Refresh Halaman</span>
                <span className="text-[10px] text-slate-500 px-2 leading-relaxed">Tunggu sekitar 1 menit agar perubahan di server Google tersinkronisasi, lalu muat ulang aplikasi ini.</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10 w-full">
            <button 
              onClick={() => setActiveTab("analysis")} 
              className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm transition-all border border-white/10"
            >
              Kembali
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="flex-1 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-sm transition-all shadow-xl shadow-blue-900/40"
            >
              Check Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col md:flex-row h-screen w-full font-sans overflow-hidden selection:bg-blue-500/30 transition-colors duration-500",
      theme === 'dark' ? "bg-navy-950 text-slate-200" : "bg-slate-50 text-slate-900"
    )}>
      <Toaster />
      
      {/* Sidebar (Desktop) */}
      <aside className={cn(
        "w-72 border-r flex flex-col hidden md:flex relative z-50 transition-colors duration-500",
        theme === 'dark' ? "bg-navy-900 border-white/5" : "bg-white border-slate-200"
      )}>
        <div className="p-8">
          <div className="flex items-center gap-3">
            <Logo className={cn("w-8 h-8", theme === 'dark' ? "text-white" : "text-blue-600")} />
            <h1 className={cn("text-xl font-black tracking-tight leading-none", theme === 'dark' ? "text-white" : "text-slate-900")}>PantauLangit AI</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-5 py-6 space-y-3">
          {[
            { id: "analysis", icon: Camera, label: "Scan Reality" },
            { id: "history", icon: History, label: "Evolution Data" },
            { id: "map", icon: MapIcon, label: "Global Presence" },
            { id: "settings", icon: Settings, label: "Control Hub" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as "analysis" | "history" | "map" | "settings")}
              className={cn(
                "w-full px-6 py-5 rounded-2xl flex items-center gap-5 transition-all duration-300 group relative overflow-hidden border",
                activeTab === item.id 
                  ? "bg-blue-600/10 text-blue-500 border-blue-500/20 shadow-lg shadow-blue-500/5 font-black" 
                  : theme === 'dark' 
                    ? "border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"
                    : "border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              )}
            >
              {activeTab === item.id && (
                <motion.div layoutId="activeNav" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />
              )}
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", activeTab === item.id ? "text-blue-500" : "text-slate-400")} />
              <span className="font-bold text-[13px] tracking-widest uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={cn("p-6 mt-auto border-t", theme === 'dark' ? "border-white/5" : "border-slate-100")}>
          <div className="flex flex-col gap-2">
            <p className={cn("text-[10px] font-black uppercase tracking-widest text-center", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Public Neural Node</p>
            <p className={cn("text-[10px] text-center uppercase tracking-tighter", theme === 'dark' ? "text-slate-600" : "text-slate-300")}>Access Mode: Free & Collective</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* Futuristic Background Grain/Glow */}
        <div className={cn("absolute inset-0 z-0 transition-colors duration-500", theme === 'dark' ? "bg-navy-950" : "bg-slate-50")}></div>
        <div className={cn("absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none", theme === 'dark' ? "bg-blue-500/5" : "bg-blue-500/10")}></div>
        
        {/* Header */}
        <header className={cn(
          "h-24 border-b flex items-center justify-between px-6 md:px-10 sticky top-0 z-40 backdrop-blur-2xl transition-colors duration-500",
          theme === 'dark' ? "bg-navy-950/95 border-white/5" : "bg-white/80 border-slate-200"
        )}>
          <div className="flex items-center gap-4 md:gap-8">
             <Logo className={cn("w-8 h-8 md:hidden", theme === 'dark' ? "text-white" : "text-blue-600")} />
             <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", location ? "bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.7)]" : "bg-red-500")}></span>
                  <p className={cn("text-sm font-black tracking-[0.2em] uppercase transition-colors", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    {activeTab === "analysis" ? "Atmosphere Scan" : activeTab === "history" ? "Data Evolution" : activeTab === "map" ? "Global Reach" : "System Control"}
                  </p>
                </div>
                <span className={cn("text-[10px] font-bold tracking-wider mt-1.5 ml-5 flex items-center gap-2", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                  {isOffline ? (
                    <span className="flex items-center gap-1.5 text-amber-500">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      OFFLINE MODE
                    </span>
                  ) : (
                    "SYSTEM READY"
                  )} • {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "AQUIRING GPS..."}
                </span>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                 <div className="w-9 h-9 rounded-2xl glass flex items-center justify-center border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                 </div>
              </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto pb-44 lg:pb-12 pt-0 md:pt-0">
          <AnimatePresence mode="wait">
            {activeTab === "analysis" && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col lg:grid lg:grid-cols-12 gap-10 lg:gap-8 lg:p-10 max-w-[1700px] mx-auto w-full"
              >
                {/* Visual Analysis Area */}
                <div className="w-full lg:col-span-8 lg:order-1 flex flex-col gap-8">
                  <div className="relative w-full aspect-[3/4] md:aspect-video lg:aspect-auto lg:h-[680px] bg-navy-900 rounded-[2.5rem] md:rounded-[4rem] overflow-hidden border border-white/10 shadow-2xl group ring-1 ring-white/5 mx-auto">
                    {!isCapturing ? (
                       <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 md:gap-12 bg-navy-950/40 backdrop-blur-3xl p-6 md:p-10 overflow-hidden">
                          <div className="relative p-8 md:p-12">
                            {/* Decorative Background Glow - Contained */}
                            <div className="absolute inset-0 bg-blue-500 rounded-full blur-[60px] opacity-10 animate-pulse-glow scale-75"></div>
                            
                            <div className="relative">
                              <AnimatePresence>
                                {isInitializing ? (
                                  <motion.div 
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="absolute inset-0 flex items-center justify-center z-20"
                                  >
                                     <div className="w-36 h-36 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                              <div className={cn(
                                "w-28 h-28 rounded-[2.5rem] glass flex items-center justify-center relative z-10 border-white/10 transition-all duration-700 shadow-[0_0_50px_rgba(59,130,246,0.15)]",
                                isInitializing ? "scale-110 rotate-180 opacity-50" : "group-hover:rotate-12"
                              )}>
                                <Logo className={cn("w-16 h-16", isInitializing && "animate-pulse")} />
                              </div>
                            </div>
                          </div>
                          <div className="text-center px-6 relative z-10">
                            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                              {isInitializing ? "Booting Neural Core..." : "Sync Reality"}
                            </h3>
                            <p className="text-sm md:text-base text-slate-400 mt-2 md:mt-4 max-w-xs md:max-w-sm leading-relaxed font-medium mx-auto">
                              {isInitializing 
                                ? "Establishing encrypted link with satellite vision cluster..." 
                                : "Akses sistem penglihatan AI untuk modulasi data kualitas udara real-time melalui visibilitas atmosfer."}
                            </p>
                          </div>
                          {!isInitializing && (
                            <div className="relative group/btn mt-4 z-10">
                              <div className="absolute -inset-4 bg-blue-500/10 blur-2xl rounded-full opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                              <button 
                                onClick={startCamera}
                                className="relative bg-blue-600 hover:bg-blue-500 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl font-black transition-all shadow-xl shadow-blue-900/40 hover:scale-105 active:scale-95 flex items-center gap-3 group text-sm md:text-base"
                              >
                                <Wind className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                                Inisialisasi Scan
                              </button>
                            </div>
                          )}
                       </div>
                    ) : (
                      <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/40 pointer-events-none"></div>
                        
                        {/* Vision Analysis - Focusing Indicator */}
                        <AnimatePresence>
                          {isFocusing && (
                            <motion.div
                              initial={{ opacity: 0, scale: 1.2 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                            >
                              <div className="relative w-24 h-24">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-500 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-500 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-500 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-500 rounded-br-lg" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                </div>
                              </div>

                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Weather Overlay Panel */}
                        <AnimatePresence>
                          {showWeatherOverlay && weatherData && (
                            <motion.div 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="absolute top-4 right-4 z-30 group"
                            >
                              <div className="glass-dark border-white/10 p-3 rounded-[1.5rem] shadow-2xl relative overflow-hidden backdrop-blur-2xl w-24">
                                <button 
                                  onClick={() => setShowWeatherOverlay(false)}
                                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                                
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-col items-center text-center gap-1 border-b border-white/5 pb-2">
                                     <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                                        <Cloud className="w-3 h-3" />
                                     </div>
                                     <div>
                                        <p className="text-[6px] font-black text-blue-500 uppercase tracking-widest leading-none">Status</p>
                                        <h4 className="text-[8px] font-black text-white mt-0.5 truncate max-w-full">{weatherData.condition}</h4>
                                     </div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-col items-center">
                                      <div className="flex items-center gap-1">
                                        <Thermometer className="w-2.5 h-2.5 text-red-400" />
                                        <span className="text-[9px] text-white font-black">{weatherData.temp}°</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="flex items-center gap-1">
                                        <Droplets className="w-2.5 h-2.5 text-blue-400" />
                                        <span className="text-[9px] text-white font-black">{weatherData.humidity}%</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="flex items-center gap-1">
                                        <Wind className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-[9px] text-white font-black">{weatherData.wind}k</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="flex items-center gap-1">
                                        <RefreshCw className="w-2.5 h-2.5 text-amber-400" />
                                        <span className="text-[9px] text-white font-black">{weatherData.uv}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Vision Stats Overlay */}
                        <div className="absolute top-8 left-8 z-20 flex flex-col gap-3">
                          <div className="glass px-4 py-2 rounded-full border-white/20 flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                              {isAnalyzing ? "NEURAL COMPUTE ACTIVE" : "VISION ENGINE: 30 FPS"}
                            </span>
                          </div>
                          <div className="glass px-4 py-2 rounded-full border-white/20 inline-flex items-center gap-3">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">
                              LATENCY: 42ms
                            </span>
                          </div>
                        </div>

                        {/* Capture Controls */}
                        <div className="absolute bottom-10 left-6 right-6 z-20 flex flex-col items-center sm:flex-row sm:justify-between sm:items-end gap-6">
                          <div className="space-y-2 text-center sm:text-left">
                             <h2 className="text-xl font-black text-white tracking-tighter">
                               {location ? locationName : "Grid Aquiring"}
                             </h2>
                             <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-400">
                                <Navigation className="w-2.5 h-2.5" />
                                <span className="text-[9px] font-bold tracking-widest uppercase">Sector: {location?.lat.toFixed(2)}N / {location?.lng.toFixed(2)}E</span>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={stopCamera}
                              className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 backdrop-blur-xl p-5 rounded-3xl transition-all flex items-center justify-center active:scale-95 group shadow-2xl"
                              title="Hentikan Scan"
                            >
                              <Camera className="w-6 h-6 text-red-500" />
                            </button>

                            {recordedVideoUrl ? (
                              <a 
                                href={recordedVideoUrl} 
                                download={`PantauLangit_Rec_${new Date().getTime()}.webm`}
                                className="glass hover:bg-emerald-500/10 text-emerald-400 p-5 rounded-3xl transition-all border-emerald-500/20 flex items-center justify-center active:scale-95"
                                title="Download Recording"
                              >
                                <Download className="w-6 h-6" />
                              </a>
                            ) : (
                              <button 
                                onClick={isRecording ? stopRecording : startRecording}
                                className={cn(
                                  "p-5 rounded-3xl transition-all border active:scale-95 flex items-center justify-center min-w-[64px]",
                                  isRecording 
                                    ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" 
                                    : "glass border-white/20 text-white hover:bg-white/10"
                                )}
                                title={isRecording ? "Stop Recording" : "Start Video Rec"}
                              >
                                <div className={cn("transition-all duration-300", isRecording ? "w-4 h-4 bg-red-500 rounded-sm" : "w-6 h-6 border-2 border-white rounded-full")}></div>
                              </button>
                            )}
                            
                            <button 
                              onClick={analyzeFrame}
                              disabled={isAnalyzing}
                              className="bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-3xl font-black transition-all shadow-2xl shadow-blue-900/60 flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95"
                              title="Capture Analysis"
                            >
                              {isAnalyzing ? (
                                <RefreshCw className="w-6 h-6 animate-spin" />
                              ) : (
                                <Camera className="w-6 h-6" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Scan Line & UI Elements */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-[scan_4s_linear_infinite]"></div>
                          <div className="absolute top-1/2 left-0 w-full h-px bg-white/5"></div>
                          <div className="absolute top-0 left-1/2 w-px h-full bg-white/5"></div>
                          
                          {/* Corner Markers */}
                          <div className="absolute top-10 left-10 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg"></div>
                          <div className="absolute top-10 right-10 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-lg"></div>
                          <div className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-lg"></div>
                          <div className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg"></div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Analysis Result Narrative & Pollutant Breakdown */}
                  <AnimatePresence>
                    {analysis && (
                      <motion.div 
                        initial={{ opacity: 0, y: 30 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-6"
                      >
                        <div className="glass-dark border border-white/5 p-8 rounded-[2rem] relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                          <div className="flex items-start gap-6">
                             <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center shrink-0">
                                <Info className="w-7 h-7 text-blue-400" />
                             </div>
                             <div className="flex-1">
                                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2">Neural Link Feed</h3>
                                <p className="text-slate-300 text-lg leading-relaxed font-bold tracking-tight">
                                  "{analysis.description}"
                                </p>
                                <div className="flex gap-4 mt-6">
                                   <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence</span>
                                      <span className="text-sm font-black text-white">{analysis.confidence}%</span>
                                   </div>
                                   <div className="w-px h-8 bg-white/10"></div>
                                   <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Particulate</span>
                                      <span className="text-sm font-black text-white">{analysis.dominantParticulate}</span>
                                   </div>
                                </div>

                                {analysis.rekomendasi && (
                                  <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/10">
                                     <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Rekomendasi AI</span>
                                     </div>
                                     <p className="text-xs font-bold text-white leading-relaxed italic">
                                        "{analysis.rekomendasi}"
                                     </p>
                                  </div>
                                )}
                             </div>
                          </div>
                        </div>

                        {/* Visualisasi Sekitar - IQAir Style */}
                        {analysis.visualisasiSekitar && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              { label: "Radius 1KM", value: analysis.visualisasiSekitar.radius_1km, icon: <Maximize2 className="w-4 h-4" /> },
                              { label: "Radius 5KM", value: analysis.visualisasiSekitar.radius_5km, icon: <Maximize2 className="w-4 h-4" /> },
                              { label: "Radius 10KM", value: analysis.visualisasiSekitar.radius_10km, icon: <Maximize2 className="w-4 h-4" /> }
                            ].map((v, i) => (
                              <motion.div 
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-dark border border-white/5 p-5 rounded-3xl"
                              >
                                <div className="flex items-center gap-3 mb-3">
                                   <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                                      {v.icon}
                                   </div>
                                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{v.label}</span>
                                </div>
                                <p className="text-xs font-black text-white leading-tight">
                                   {v.value}
                                </p>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Detailed Breakdown Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                          {/* Weather Forecast Card (New Component) */}
                          {analysis.weather && (
                            <WeatherForecast weather={analysis.weather} className="lg:col-span-1" />
                          )}

                          <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analysis.pollutants && analysis.pollutants.map((p, idx) => (
                              <motion.div 
                                key={p.name}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className="glass-dark border border-white/5 p-5 rounded-3xl relative group overflow-hidden h-full"
                              >
                                {/* Visual Cue Overlay */}
                                <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <Cpu className="w-16 h-16" />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{p.name}</h4>
                                    <div className="flex items-baseline gap-1 mt-1">
                                      <span className="text-xl font-black text-white">{p.value}</span>
                                      <span className="text-[8px] font-bold text-slate-500">{p.unit}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-slate-500 uppercase">Confidence</span>
                                    <span className="text-[10px] font-black text-emerald-400">{p.confidence}%</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  {p.visualCues && p.visualCues.map((cue, cIdx) => (
                                    <div key={cIdx} className="flex items-center gap-2">
                                      <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                                      <span className="text-[9px] font-medium text-slate-400 italic">"{cue}"</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${p.confidence}%` }}
                                    className="h-full bg-blue-500/40"
                                  />
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right Stats Dashboard */}
                <div className="col-span-12 lg:col-span-4 lg:order-2 flex flex-col gap-6 w-full p-6 lg:p-0">
                  <div className="flex flex-col gap-6 lg:min-h-[680px]">
                    {/* AQI Score Card - Hero Section */}
                    <motion.div 
                      layout
                      className={cn(
                        "w-full flex-1 rounded-[2.5rem] p-10 shadow-3xl relative overflow-hidden group transition-all duration-700 flex flex-col justify-center border border-white/5",
                        analysis ? getAQIColor(analysis.estimatedAQI) : "glass-dark border-white/10"
                      )}
                    >
                      {/* Decorative Background Glow */}
                      <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-[80px] group-hover:scale-125 transition-transform duration-1000"></div>
                      
                      <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Estimated AQI</span>
                            <span className="text-xs font-bold opacity-80">{analysis?.lokasi || "Local Atmosphere Monitoring"}</span>
                          </div>
                          {analysis && (
                            <div className="px-4 py-1.5 glass rounded-full text-[10px] font-black uppercase tracking-widest border-white/20">
                              {analysis.status}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-6 mb-8">
                          <div className="relative">
                            <svg className="w-32 h-32 transform -rotate-90">
                              <circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="opacity-20"
                              />
                              <motion.circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={364.4}
                                initial={{ strokeDashoffset: 364.4 }}
                                animate={{ strokeDashoffset: 364.4 - (364.4 * Math.min((analysis?.estimatedAQI || 0) / 300, 1)) }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-4xl font-black">{analysis?.estimatedAQI || "--"}</span>
                              <span className="text-[10px] font-bold opacity-60">SCORE</span>
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            <h2 className="text-xl font-black leading-tight tracking-tight">
                              {analysis ? getAQIStatus(analysis.estimatedAQI).toUpperCase() : "READY TO SCAN"}
                            </h2>
                            <p className="text-xs mt-2 opacity-70 leading-relaxed font-medium">
                              {analysis 
                                ? "Kondisi udara di lokasi Anda saat ini. Pastikan perlindungan yang sesuai." 
                                : "Arahkan kamera ke area terbuka untuk memulai estimasi kualitas udara."}
                            </p>
                          </div>
                        </div>

                        {analysis && (
                          <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
                              <Wind className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold opacity-60">POLLUTION LEVEL</span>
                                <span className="text-[10px] font-black">{((analysis.estimatedAQI / 500) * 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 w-full glass rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min((analysis.estimatedAQI / 500) * 100, 100)}%` }}
                                  className="h-full bg-white transition-all duration-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Real-time Trend / Comparison Graph */}
                    <div className="glass-dark rounded-[2.5rem] p-6 border border-white/5 relative overflow-hidden min-h-[220px]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            {selectedForComparison.length > 0 ? "Comparative Diagnostics" : "Real-time Trend"}
                          </span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                            {selectedForComparison.length > 0 ? `Comparing ${selectedForComparison.length} Nodes` : "Last 5 Minutes"}
                          </span>
                        </div>
                        {selectedForComparison.length === 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
                          </div>
                        )}
                        {selectedForComparison.length > 0 && (
                          <button 
                            onClick={() => setSelectedForComparison([])}
                            className="text-[8px] font-black text-slate-500 hover:text-white uppercase tracking-widest border border-white/10 px-2 py-1 rounded-md transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {selectedForComparison.length > 0 ? (
                            <BarChart data={history.filter(h => selectedForComparison.includes(h.id)).reverse()}>
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                hide 
                              />
                              <YAxis hide domain={[0, 'auto']} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#071226', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                labelFormatter={(val) => new Date(val).toLocaleString()}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              />
                              <Bar dataKey="aqi" radius={[4, 4, 0, 0]} animationDuration={1000}>
                                {history.filter(h => selectedForComparison.includes(h.id)).reverse().map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={getAQIColor(entry.aqi).includes('emerald') ? '#10b981' : entry.aqi > 150 ? '#ef4444' : entry.aqi > 100 ? '#f97316' : '#eab308'} />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : (
                            <AreaChart data={realTimeHistory}>
                              <defs>
                                <linearGradient id="colorRtAqi" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="timestamp" hide />
                              <YAxis hide domain={['auto', 'auto']} />
                              <Tooltip 
                                 contentStyle={{ backgroundColor: '#071226', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                 labelFormatter={(val) => new Date(val).toLocaleTimeString()}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="aqi" 
                                stroke="#3b82f6" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorRtAqi)" 
                                animationDuration={1000}
                                isAnimationActive={true}
                              />
                            </AreaChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Quick Forecast Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass-dark rounded-3xl p-5 border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/20">
                            <Thermometer className="w-4 h-4 text-orange-400" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Feels Like</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black">32</span>
                          <span className="text-sm font-bold text-slate-500">°C</span>
                        </div>
                      </div>
                      <div className="glass-dark rounded-3xl p-5 border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                            <Droplets className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Humidity</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black">64</span>
                          <span className="text-sm font-bold text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Health Insights */}
                  {analysis && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-dark rounded-4xl p-6 border-white/5 relative overflow-hidden"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-10">
                            <AlertTriangle className="w-12 h-12" />
                         </div>
                         <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3">Rekomendasi Kesehatan</h4>
                         <p className="text-sm text-slate-300 leading-relaxed font-medium">
                           {analysis.estimatedAQI > 100 
                             ? "Disarankan untuk mengurangi aktivitas luar ruangan yang berat. Gunakan masker tipe N95 jika Anda sensitif terhadap polusi."
                             : "Kualitas udara sangat baik untuk berolahraga di luar ruangan atau aktivitas santai lainnya."}
                         </p>
                      </motion.div>
                    )}
                </div>
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 md:space-y-10 p-3 md:p-10"
              >
                <div id="report-area" className="glass border border-white/5 p-4 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8 mb-8 md:mb-12 relative z-10">
                    <div className="w-full md:w-auto">
                      <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Historical Log</h3>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">Evolution Metrics</h2>
                      <p className="text-slate-500 text-xs md:text-sm mt-3 max-w-md font-medium leading-relaxed">Analisis mendalam mengenai fluktuasi kualitas udara di sektor Anda berdasarkan rekaman sensor fusion.</p>
                      
                      {isOffline && (
                        <div className="mt-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl animate-pulse">
                          <div className="p-1.5 bg-amber-500/20 rounded-lg">
                            <Info className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <p className="text-[10px] md:text-xs font-bold text-amber-200">
                             Viewing cached data while offline. New recordings will be saved locally.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 bg-navy-900/50 p-1.5 md:p-2 rounded-[2rem] border border-white/5 w-full md:w-auto overflow-x-auto">
                      <div className="flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 glass rounded-[1.5rem] text-center border-white/10 min-w-[100px] md:min-w-[120px]">
                        <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Mean AQI</p>
                        <p className="text-xl md:text-2xl font-black text-blue-400">
                          {historyAqiMean}
                        </p>
                      </div>
                      <div className="flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 text-center min-w-[100px] md:min-w-[120px]">
                        <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Data Nodes</p>
                        <p className="text-xl md:text-2xl font-black text-white">{history.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="h-[400px] w-full mb-12 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...history].reverse()}>
                        <defs>
                          <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.03} vertical={false} />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(val) => val ? new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          stroke="#475569"
                          fontSize={10}
                          fontWeight="900"
                          axisLine={false}
                          tickLine={false}
                          dy={15}
                        />
                        <YAxis stroke="#475569" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#071226', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', fontSize: '12px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="aqi" 
                          stroke="#3b82f6" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorAqi)" 
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Logs Table */}
                  <div className="overflow-x-auto glass-dark rounded-3xl border border-white/5">
                    <table className="w-full text-left text-sm min-w-[800px] md:min-w-full">
                      <thead>
                        <tr className="bg-white/5 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">
                          <th className="px-4 md:px-8 py-5 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedForComparison.length === history.length && history.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedForComparison(history.map(l => l.id));
                                } else {
                                  setSelectedForComparison([]);
                                }
                              }}
                              className="w-4 h-4 rounded border-white/10 bg-navy-950 accent-blue-500"
                            />
                          </th>
                          <th className="px-4 md:px-8 py-5">Temporal Stamp</th>
                          <th className="px-4 md:px-8 py-5">Sector Address</th>
                          <th className="px-4 md:px-8 py-5 text-center">Indeks</th>
                          <th className="px-4 md:px-8 py-5">Registry State</th>
                          <th className="px-4 md:px-8 py-5">Atmospheric Index</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {history.length > 0 ? history.map((log) => (
                          <tr key={log.id} className={cn(
                            "hover:bg-white/[0.02] transition-colors group",
                            selectedForComparison.includes(log.id) && "bg-blue-500/5"
                          )}>
                            <td className="px-4 md:px-8 py-6 text-center">
                              <input 
                                type="checkbox" 
                                checked={selectedForComparison.includes(log.id)}
                                onChange={() => {
                                  setSelectedForComparison(prev => 
                                    prev.includes(log.id) 
                                      ? prev.filter(id => id !== log.id) 
                                      : [...prev, log.id]
                                  );
                                }}
                                className="w-4 h-4 rounded border-white/10 bg-navy-950 accent-blue-500"
                              />
                            </td>
                            <td className="px-4 md:px-8 py-6 font-bold text-slate-400 group-hover:text-white transition-colors">
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                            </td>
                            <td className="px-4 md:px-8 py-6 text-slate-500 font-medium">{log.address || "Jakarta Pusat"}</td>
                            <td className="px-4 md:px-8 py-6 text-center">
                              <span className={cn("text-lg font-black", getAQITextColor(log.aqi))}>{log.aqi}</span>
                            </td>
                            <td className="px-4 md:px-8 py-6">
                              <span className="text-[10px] font-black bg-navy-950 px-3 py-1.5 rounded-full text-slate-400 border border-white/5 uppercase tracking-widest">
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 md:px-8 py-6 font-mono text-slate-500 font-black">{(log.visibilityIndex * 100).toFixed(0)}% CLEAR</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-8 py-20 text-center text-slate-600">
                              <div className="flex flex-col items-center gap-4 opacity-30">
                                <RefreshCw className="w-12 h-12 animate-[spin_10s_linear_infinite]" />
                                <p className="font-black uppercase tracking-widest text-xs">No historical data segments found.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "map" && (
              <motion.div 
                key="map"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-[calc(100vh-180px)] w-full rounded-[3.5rem] overflow-hidden border border-white/5 relative shadow-2xl"
              >
                <div className="absolute inset-0 bg-navy-950/20 backdrop-blur-sm z-0"></div>
                
                <PollutionMap 
                  apiKey={MAPS_API_KEY} 
                  mapId={MAPS_MAP_ID}
                  userLocation={deviceLocation} 
                  targetLocation={location}
                  historyData={history}
                  weatherData={weatherData}
                  analysisData={analysis}
                  onLocationChange={(newLoc) => {
                    setLocation(newLoc);
                    fetchWeatherData(newLoc.lat, newLoc.lng);
                    fetchLocationName(newLoc.lat, newLoc.lng);
                  }}
                  onRecenter={() => {
                    if (deviceLocation) {
                      setLocation(deviceLocation);
                      fetchWeatherData(deviceLocation.lat, deviceLocation.lng);
                      fetchLocationName(deviceLocation.lat, deviceLocation.lng);
                    }
                  }}
                />
                
                {/* Map Overlay Stats & Weather Widget */}
                <div className="absolute top-4 right-4 z-10 w-36 space-y-2">
                  <div className="glass-dark border border-white/10 p-2.5 rounded-[1rem] shadow-2xl">
                    <h4 className="text-[7px] font-black text-slate-500 uppercase tracking-[0.1em] mb-2 px-1">Pollution Legend</h4>
                    <div className="space-y-1.5">
                      {[
                        { label: "Optimal (0-50)", color: "bg-emerald-500" },
                        { label: "Moderate (51-100)", color: "bg-yellow-500" },
                        { label: "Alert (101-150)", color: "bg-orange-500" },
                        { label: "Critical (151+)", color: "bg-rose-600" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 px-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.2)]", item.color)}></div>
                          <span className="text-[7px] text-slate-300 font-bold tracking-tight uppercase">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Floating AI Weather Widget */}
                  {analysis?.weather && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      className="glass-dark border border-emerald-500/20 p-4 rounded-[1.5rem] shadow-3xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 blur-[30px] rounded-full"></div>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                             <Cloud className="w-3 h-3" />
                          </div>
                          <div>
                             <h4 className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Weather Matrix</h4>
                             <p className="text-[8px] font-bold text-white">{analysis.weather.condition}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1 py-2 border-y border-white/5">
                           <div className="flex flex-col items-center">
                              <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">TEMP</span>
                              <span className="text-[10px] font-black text-white">{analysis.weather.temperature}°</span>
                           </div>
                           <div className="flex flex-col items-center">
                              <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">WIND</span>
                              <span className="text-[10px] font-black text-white">{analysis.weather.windSpeed}k</span>
                           </div>
                           <div className="flex flex-col items-center">
                              <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">HUM</span>
                              <span className="text-[10px] font-black text-white">{analysis.weather.humidity}%</span>
                           </div>
                        </div>

                        <div className="flex flex-col gap-1 pt-1">
                          <div className="flex items-center gap-1.5">
                             <Wind className="w-2.5 h-2.5 text-emerald-400" />
                             <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Atmosphere</span>
                          </div>
                          <p className="text-[8px] font-medium text-slate-400 leading-tight italic line-clamp-2">
                             "{analysis.weather.effectOnPollution}"
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 z-10">
                   <div className="bg-blue-600 px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/40 border border-blue-400/30">
                     Live Distribution
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-10 p-6 md:p-10 relative z-10"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h2 className={cn("text-4xl font-black tracking-tighter transition-colors", theme === 'dark' ? "text-white" : "text-slate-900")}>System Configuration</h2>
                    <p className={cn("text-sm mt-2 font-medium transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Atur preferensi visual dan manajemen data sistem PantauLangit AI.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Theme Settings */}
                  <div className={cn(
                    "glass border p-8 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500",
                    theme === 'dark' ? "border-white/5" : "bg-white/40 border-slate-200"
                  )}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="flex items-center gap-4 mb-8">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                        theme === 'dark' ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-100"
                      )}>
                        {theme === 'dark' ? <Moon className="w-6 h-6 text-blue-400" /> : <Sun className="w-6 h-6 text-blue-600" />}
                      </div>
                      <h3 className={cn("text-xl font-black tracking-tight transition-colors", theme === 'dark' ? "text-white" : "text-slate-900")}>Visual Interface</h3>
                    </div>

                    <div className="space-y-6">
                      <div className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-colors",
                        theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-100"
                      )}>
                        <div className="flex flex-col">
                          <span className={cn("text-sm font-bold transition-colors", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>Tema Aplikasi</span>
                          <span className={cn("text-[10px] uppercase tracking-widest font-black transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Current: {theme === 'dark' ? 'Neural Dark' : 'Spectral Light'}</span>
                        </div>
                        <button 
                          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                          className={cn(
                            "relative w-14 h-8 rounded-full border p-1 transition-all cursor-pointer",
                            theme === 'dark' ? "bg-navy-950 border-white/10" : "bg-slate-200 border-slate-300"
                          )}
                        >
                          <motion.div 
                            animate={{ x: theme === 'dark' ? 24 : 0 }}
                            className="w-6 h-6 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center justify-center"
                          >
                            {theme === 'dark' ? <Moon className="w-3 h-3 text-white" /> : <Sun className="w-3 h-3 text-white" />}
                          </motion.div>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setTheme('dark')}
                          className={cn(
                            "flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all",
                            theme === 'dark' ? "bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20" : "bg-white/5 hover:bg-white/10 border-slate-100"
                          )}
                        >
                          <Moon className={cn("w-6 h-6 transition-colors", theme === 'dark' ? "text-blue-400" : "text-slate-400")} />
                          <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-blue-400" : "text-slate-500")}>Dark Mode</span>
                        </button>
                        <button 
                          onClick={() => setTheme('light')}
                          className={cn(
                            "flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all",
                            theme === 'light' ? "bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20" : "bg-white/5 hover:bg-slate-50 border-slate-100"
                          )}
                        >
                          <Sun className={cn("w-6 h-6 transition-colors", theme === 'light' ? "text-blue-600" : "text-slate-400")} />
                          <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", theme === 'light' ? "text-blue-600" : "text-slate-500")}>Light Mode</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reporting Center */}
                  <div className={cn(
                    "glass border p-8 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500",
                    theme === 'dark' ? "border-white/5" : "bg-white/40 border-slate-200"
                  )}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="flex items-center gap-4 mb-8">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                        theme === 'dark' ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-100"
                      )}>
                        <FileText className={cn("w-6 h-6", theme === 'dark' ? "text-purple-400" : "text-purple-600")} />
                      </div>
                      <h3 className={cn("text-xl font-black tracking-tight transition-colors", theme === 'dark' ? "text-white" : "text-slate-900")}>Reporting Center</h3>
                    </div>

                    <div className="space-y-4">
                      <div className={cn(
                        "p-6 rounded-3xl border transition-colors",
                        theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-100"
                      )}>
                        <h4 className={cn("text-sm font-bold mb-2 transition-colors", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>Evolution Full Report</h4>
                        <p className={cn("text-xs mb-6 leading-relaxed transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Ekspor seluruh data riwayat kualitas udara ke dalam format dokumen PDF profesional.</p>
                        
                        <button 
                          onClick={exportPDF}
                          disabled={history.length === 0}
                          className="w-full flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:grayscale py-4 rounded-2xl font-black text-xs transition-all text-white shadow-xl shadow-purple-900/40"
                        >
                          <Download className="w-4 h-4" />
                          GENERATE FULL PDF REPORT
                        </button>
                      </div>

                      <div className="flex items-center justify-between px-2">
                        <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Total Logs Ready: {history.length}</span>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Export Limit: A4 Format</span>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                        <button 
                          onClick={() => {
                            if (confirm("Are you sure you want to delete all historical AQI records (including local data)? This action cannot be undone.")) {
                              clearLocalAQI();
                              setHistory([]);
                              toast.success("Historical data has been cleared.");
                            }
                          }}
                          className="w-full flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500/20 py-4 rounded-2xl font-black text-xs transition-all text-red-500 border border-red-500/20"
                        >
                          <RefreshCw className="w-4 h-4" />
                          CLEAR ALL LOG DATA
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sensor Calibration */}
                  <div className={cn(
                    "glass border p-8 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500 col-span-1 md:col-span-2",
                    theme === 'dark' ? "border-white/5" : "bg-white/40 border-slate-200"
                  )}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                          theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"
                        )}>
                          <Cpu className={cn("w-6 h-6", theme === 'dark' ? "text-emerald-400" : "text-emerald-600")} />
                        </div>
                        <div>
                          <h3 className={cn("text-xl font-black tracking-tight transition-colors", theme === 'dark' ? "text-white" : "text-slate-900")}>Sensor Calibration</h3>
                          <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Precision Tuning & Data Management</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setCalibration({ pm25Offset: 0, pm10Offset: 0, tempOffset: 0, humidityOffset: 0 });
                          toast.success("Sensor offsets have been reset to zero.");
                        }}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset All Sensors
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { key: 'pm25Offset', label: 'PM2.5 Offset', icon: Wind, unit: 'µg/m³' },
                        { key: 'pm10Offset', label: 'PM10 Offset', icon: Navigation, unit: 'µg/m³' },
                        { key: 'tempOffset', label: 'Temp Offset', icon: Thermometer, unit: '°C' },
                        { key: 'humidityOffset', label: 'Humid Offset', icon: Droplets, unit: '%' }
                      ].map(item => (
                        <div key={item.key} className={cn(
                          "p-6 rounded-3xl border transition-colors relative",
                          theme === 'dark' ? "bg-white/[0.02] border-white/5 hover:border-white/10" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                        )}>
                          <div className="flex items-center gap-3 mb-4">
                            <item.icon className="w-4 h-4 text-emerald-500" />
                            <span className={cn("text-xs font-bold uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>{item.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input 
                              type="number" 
                              value={calibration[item.key as keyof typeof calibration]} 
                              onChange={(e) => setCalibration(prev => ({ ...prev, [item.key]: parseFloat(e.target.value) || 0 }))}
                              className={cn(
                                "w-full bg-transparent border-b outline-none text-lg font-black transition-colors px-1",
                                theme === 'dark' ? "border-white/10 text-white focus:border-emerald-500" : "border-slate-200 text-slate-900 focus:border-emerald-600"
                              )}
                            />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.unit}</span>
                          </div>
                          <div className="mt-4 flex gap-2">
                             <button 
                               onClick={() => setCalibration(prev => ({ ...prev, [item.key]: prev[item.key as keyof typeof prev] - 1 }))}
                               className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
                             >
                                <Sliders className="w-3 h-3 rotate-180" />
                             </button>
                             <button 
                               onClick={() => setCalibration(prev => ({ ...prev, [item.key]: prev[item.key as keyof typeof prev] + 1 }))}
                               className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
                             >
                                <Sliders className="w-3 h-3" />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "glass border p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500",
                  theme === 'dark' ? "border-white/5" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-14 h-14 rounded-[1.5rem] flex items-center justify-center border shrink-0 transition-colors",
                      theme === 'dark' ? "bg-navy-900 border-white/10" : "bg-slate-50 border-slate-200"
                    )}>
                      <Logo className={cn("w-8 h-8", theme === 'dark' ? "text-white" : "text-blue-600")} />
                    </div>
                    <div>
                      <h4 className={cn("text-lg font-black transition-colors", theme === 'dark' ? "text-white" : "text-slate-900")}>System Status: Collective Node</h4>
                      <p className={cn("text-xs mt-1 transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>Aplikasi berjalan pada mode publik. Data disinkronkan secara real-time dengan neural network global.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20 uppercase tracking-widest">Global Sync Active</span>
                    <span className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black border border-blue-500/20 uppercase tracking-widest">Free Public Access</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation - Sticky */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 h-24 glass border-t md:hidden z-50 px-6 flex items-center justify-between pb-4 transition-colors duration-500",
        theme === 'dark' ? "border-white/10" : "bg-white/80 border-slate-200"
      )}>
        {[
          { id: "analysis", icon: Camera, label: "Scan" },
          { id: "history", icon: History, label: "Data" },
          { id: "map", icon: MapIcon, label: "Global" },
          { id: "settings", icon: Settings, label: "System" }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as "analysis" | "history" | "map" | "settings")}
            className={cn(
              "flex flex-col items-center gap-1.5 px-6 py-2 rounded-2xl transition-all",
              activeTab === item.id 
                ? "text-blue-500 bg-blue-500/10" 
                : theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

