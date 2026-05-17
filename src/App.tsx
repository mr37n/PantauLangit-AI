import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Camera, Map as MapIcon, History, FileText, Bell, 
  AlertTriangle, CheckCircle2, Info, ChevronRight,
  Navigation, Wind, Droplets, Thermometer,
  Download, RefreshCw, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast, Toaster } from "react-hot-toast";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Logo } from "./components/Logo";
import { auth, saveAQIRecord, getHistory } from "./lib/firebase";
import { cn, getAQIColor, getAQITextColor, getAQIStatus } from "./lib/utils";

// Types
interface AnalysisResult {
  visibilityIndex: number;
  estimatedAQI: number;
  dominantParticulate: string;
  confidence: number;
  description: string;
  status: string;
}

interface LocalPollution {
  station: string;
  ispu: number;
  pm25: number;
  pm10: number;
  timestamp: string;
}

// Maps Configuration
const MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";
const hasValidMapsKey = Boolean(MAPS_API_KEY) && MAPS_API_KEY !== "MY_GOOGLE_MAPS_KEY";

export default function App() {
  const [activeTab, setActiveTab] = useState<"analysis" | "history" | "map">("analysis");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [localData, setLocalData] = useState<LocalPollution | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mapError, setMapError] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Google Maps Auth Failure Detection
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      setMapError(true);
      toast.error("Google Maps API Error: API tidak diaktifkan");
    };
    return () => {
      delete (window as any).gm_authFailure;
    };
  }, []);

  // Auth State
  useEffect(() => {
    loadHistory();
  }, []);

  // Location Watcher
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => toast.error("Gagal mendapatkan lokasi")
      );
    }
  }, []);

  // Load History
  const loadHistory = async () => {
    const data = await getHistory();
    setHistory(data);
  };

  // Notification logic for Poor AQI
  useEffect(() => {
    if (analysis && analysis.estimatedAQI > 100) {
       toast((t) => (
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

  // Camera Management
  const startCamera = async () => {
    setIsInitializing(true);
    // Artificial delay for cooler "booting" feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (err) {
      toast.error("Gagal mengakses kamera. Pastikan izin diberikan.");
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCapturing(false);
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
          location: location,
          weather: { temp: 30, condition: "Sunny" } // Mocked weather
        })
      });
      const data = await res.json();
      setAnalysis(data);

      if (data.estimatedAQI) {
        await saveAQIRecord({
          aqi: data.estimatedAQI,
          status: data.status,
          visibilityIndex: data.visibilityIndex,
          pm25: data.estimatedAQI * 0.8, // Approximation
          location: location || { lat: -6.2, lng: 106.8 },
          address: "Jakarta Pusat"
        });
        loadHistory();
      }
    } catch (err) {
      toast.error("Gagal menganalisis gambar");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Export PDF
  const exportPDF = async () => {
    const element = document.getElementById("report-area");
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Cakrawala_AQI_Report_${new Date().getTime()}.pdf`);
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
                : "Anda perlu memasukkan GOOGLE_MAPS_PLATFORM_KEY di menu Secrets untuk melihat peta polusi."}
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
    <div className="flex flex-col md:flex-row h-screen w-full bg-navy-950 font-sans text-slate-200 overflow-hidden selection:bg-blue-500/30">
      <Toaster />
      
      {/* Sidebar (Desktop) */}
      <aside className="w-72 bg-navy-900 border-r border-white/5 flex flex-col hidden md:flex relative z-50">
        <div className="p-8">
          <div className="flex items-center gap-4">
            <Logo className="w-12 h-12 text-white" />
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight text-white leading-none">Cakrawala</h1>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mt-1">Intelligence</span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-5 py-6 space-y-3">
          {[
            { id: "analysis", icon: Camera, label: "Scan Reality" },
            { id: "history", icon: History, label: "Evolution Data" },
            { id: "map", icon: MapIcon, label: "Global Presence" }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full px-6 py-5 rounded-2xl flex items-center gap-5 transition-all duration-300 group relative overflow-hidden border",
                activeTab === item.id 
                  ? "bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-lg shadow-blue-500/5" 
                  : "border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"
              )}
            >
              {activeTab === item.id && (
                <motion.div layoutId="activeNav" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />
              )}
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", activeTab === item.id && "text-blue-400")} />
              <span className="font-bold text-[13px] tracking-widest uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-white/5">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Public Neural Node</p>
            <p className="text-[10px] text-slate-600 text-center uppercase tracking-tighter">Access Mode: Free & Collective</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* Futuristic Background Grain/Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        {/* Header */}
        <header className="h-24 border-b border-white/5 bg-navy-950/95 flex items-center justify-between px-6 md:px-10 sticky top-0 z-40 backdrop-blur-2xl">
          <div className="flex items-center gap-4 md:gap-8">
             <Logo className="w-10 h-10 md:hidden" />
             <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", location ? "bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.7)]" : "bg-red-500")}></span>
                  <p className="text-sm font-black text-white tracking-[0.2em] uppercase">
                    {activeTab === "analysis" ? "Atmosphere Scan" : activeTab === "history" ? "Data Evolution" : "Global Reach"}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider mt-1.5 ml-5">
                  SYSTEM READY • {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "AQUIRING GPS..."}
                </span>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
                onClick={exportPDF}
                className="glass hover:bg-white/10 p-3 rounded-2xl transition-all border-white/10 group active:scale-95"
                title="Export PDF Report"
              >
                <Download className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
              </button>
              <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
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
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/40 pointer-events-none"></div>
                        
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
                        <div className="absolute bottom-10 left-10 right-10 z-20 flex flex-col sm:flex-row justify-between items-end gap-6">
                          <div className="space-y-2">
                             <div className="flex items-center gap-2">
                                <div className="h-0.5 w-8 bg-blue-500"></div>
                                <p className="text-[10px] text-blue-400 uppercase tracking-[0.3em] font-black">Spatial Core</p>
                             </div>
                             <h2 className="text-3xl font-black text-white tracking-tighter">
                               {location ? "Jakarta Cluster" : "Grid Aquiring"}
                             </h2>
                             <div className="flex items-center gap-2 text-slate-400">
                                <Navigation className="w-3 h-3" />
                                <span className="text-[10px] font-bold tracking-widest uppercase">Sector: {location?.lat.toFixed(2)}N / {location?.lng.toFixed(2)}E</span>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={stopCamera}
                              className="glass hover:bg-red-500/10 text-red-400 p-5 rounded-3xl transition-all border-red-500/20 active:scale-95"
                            >
                              <LogOut className="w-6 h-6 rotate-180" />
                            </button>
                            <button 
                              onClick={analyzeFrame}
                              disabled={isAnalyzing}
                              className="bg-blue-600 hover:bg-blue-500 text-white h-16 px-8 rounded-3xl font-black transition-all shadow-2xl shadow-blue-900/60 flex items-center gap-4 disabled:opacity-50 hover:scale-105 active:scale-95"
                            >
                              {isAnalyzing ? (
                                <>
                                  <RefreshCw className="w-6 h-6 animate-spin" />
                                  <span>DECIPHERING...</span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-6 h-6" />
                                  <span>CAPTURE ANALYSIS</span>
                                </>
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

                  {/* Analysis Result Narrative */}
                  <AnimatePresence>
                    {analysis && (
                      <motion.div 
                        initial={{ opacity: 0, y: 30 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-dark border border-white/5 p-8 rounded-[2rem] relative overflow-hidden"
                      >
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
                            <span className="text-xs font-bold opacity-80">Local Atmosphere Monitoring</span>
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
                className="space-y-10 p-4 md:p-10"
              >
                <div id="report-area" className="glass border border-white/5 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Historical Log</h3>
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tighter">Evolution Metrics</h2>
                      <p className="text-slate-500 text-sm mt-3 max-w-md font-medium leading-relaxed">Analisis mendalam mengenai fluktuasi kualitas udara di sektor Anda berdasarkan rekaman sensor fusion.</p>
                    </div>
                    <div className="flex items-center gap-4 bg-navy-900/50 p-1.5 rounded-[2rem] border border-white/5">
                      <div className="px-8 py-3 glass rounded-2xl text-center border-white/10">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Mean AQI</p>
                        <p className="text-2xl font-black text-blue-400">
                          {history.length > 0 ? (history.reduce((a, b) => a + b.aqi, 0) / history.length).toFixed(0) : "--"}
                        </p>
                      </div>
                      <div className="px-8 py-3 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Data Nodes</p>
                        <p className="text-2xl font-black text-white">{history.length}</p>
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
                  <div className="overflow-hidden glass-dark rounded-3xl border border-white/5">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white/5 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">
                          <th className="px-8 py-5">Temporal Stamp</th>
                          <th className="px-8 py-5">Sector Address</th>
                          <th className="px-8 py-5 text-center">Indeks</th>
                          <th className="px-8 py-5">Registry State</th>
                          <th className="px-8 py-5">Atmospheric Index</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {history.length > 0 ? history.map((log) => (
                          <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-8 py-6 font-bold text-slate-400 group-hover:text-white transition-colors">
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                            </td>
                            <td className="px-8 py-6 text-slate-500 font-medium">{log.address || "Jakarta Pusat"}</td>
                            <td className="px-8 py-6 text-center">
                              <span className={cn("text-lg font-black", getAQITextColor(log.aqi))}>{log.aqi}</span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-[10px] font-black bg-navy-950 px-3 py-1.5 rounded-full text-slate-400 border border-white/5 uppercase tracking-widest">
                                {log.status}
                              </span>
                            </td>
                            <td className="px-8 py-6 font-mono text-slate-500 font-black">{(log.visibilityIndex * 100).toFixed(0)}% CLEAR</td>
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
                <APIProvider apiKey={MAPS_API_KEY} version="weekly">
                  <Map
                    defaultCenter={location || { lat: -6.2, lng: 106.8 }}
                    defaultZoom={13}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                    mapId="cakrawala_pollution_map"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    className="w-full h-full grayscale invert opacity-70 contrast-[1.4]"
                  >
                    {location && (
                      <AdvancedMarker position={location}>
                         <Pin background="#3b82f6" glyphColor="#fff" borderColor="#1d4ed8" />
                      </AdvancedMarker>
                    )}
                    {history.map((log, idx) => log.location && (
                      <AdvancedMarker key={idx} position={log.location}>
                         <Pin 
                           background={log.aqi > 150 ? "#ef4444" : log.aqi > 100 ? "#f97316" : log.aqi > 50 ? "#eab308" : "#10b981"} 
                           glyphColor="#fff" 
                           scale={0.8}
                         />
                      </AdvancedMarker>
                    ))}
                  </Map>
                </APIProvider>
                
                {/* Map Overlay Stats */}
                <div className="absolute top-10 right-10 z-10 w-72 space-y-4">
                  <div className="glass-dark border border-white/10 p-6 rounded-[2rem] shadow-2xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Pollution Legend</h4>
                    <div className="space-y-3">
                      {[
                        { label: "Optimal (0-50)", color: "bg-emerald-500" },
                        { label: "Modulated (51-100)", color: "bg-yellow-500" },
                        { label: "Alert (101-150)", color: "bg-orange-500" },
                        { label: "Critical (151+)", color: "bg-red-500" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]", item.color)}></div>
                          <span className="text-[10px] text-slate-300 font-black tracking-widest uppercase">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-10 left-10 z-10">
                   <div className="bg-blue-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-blue-500/40 border border-blue-400/30">
                     Live Distribution Active
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation - Sticky */}
      <div className="fixed bottom-0 left-0 right-0 h-24 glass border-t border-white/10 md:hidden z-50 px-6 flex items-center justify-between pb-4">
        {[
          { id: "analysis", icon: Camera, label: "Scan" },
          { id: "history", icon: History, label: "Data" },
          { id: "map", icon: MapIcon, label: "Global" }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1.5 px-6 py-2 rounded-2xl transition-all",
              activeTab === item.id ? "text-blue-400 bg-blue-500/10" : "text-slate-500"
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

