import React, { useState, useMemo } from 'react';
import { Cloud, Droplets, Wind, Sun, CloudRain, CloudLightning, Calendar, History, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface WeatherForecastProps {
  weather?: {
    temperature: string;
    humidity: string;
    windSpeed: string;
    condition: string;
    effectOnPollution?: string;
  };
  locationName?: string;
  forecast?: { day: string; temp: number; icon: number; condition: string }[];
  history7d?: { date: string; temp: number; condition: string }[];
  hourlyToday?: { time: string; temp: number; condition: string }[];
  className?: string;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({ weather, locationName, forecast, history7d, hourlyToday, className }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'forecast' | 'history'>('current');

  // SAFE GUARD: Jika data dari App.tsx belum masuk, kita pasang data default agar aplikasi tidak crash
  const currentDetails = useMemo(() => {
    const temp = weather?.temperature || '29';
    const hum = parseFloat(weather?.humidity || '78');
    const wind = parseFloat(weather?.windSpeed || '12');
    const cond = (weather?.condition || 'Partly Cloudy').toLowerCase();
    
    let effect: string;
    let status: 'positive' | 'neutral' | 'negative';
    
    if (cond.includes('rain') || cond.includes('drizzle')) {
      effect = "Active precipitation is acting as a natural wet-scrubber, effectively removing airborne particulates through washout.";
      status = 'positive';
    } else if (wind > 18) {
      effect = "Strong horizontal ventilation is breaking up stagnant air pockets and dispersing local pollutants rapidly.";
      status = 'positive';
    } else if (wind < 5 && hum > 80) {
      effect = "Critical stagnation: High humidity combined with low wind is trapping pollutants in the lower boundary layer.";
      status = 'negative';
    } else if (hum > 85) {
      effect = "High moisture is likely causing hygroscopic growth of aerosols, potentially increasing the mass concentration of PM2.5.";
      status = 'negative';
    } else if (wind < 8) {
      effect = "Limited horizontal dispersion. Pollutants from local sources are likely to accumulate near their emission points.";
      status = 'neutral';
    } else {
      effect = "Standard atmospheric dispersion. Air quality is primarily influenced by local emission sources rather than weather dynamics.";
      status = 'neutral';
    }

    return {
      temperature: temp,
      humidity: hum.toString(),
      windSpeed: wind.toString(),
      condition: weather?.condition || 'Partly Cloudy',
      effectOnPollution: effect,
      impactStatus: status
    };
  }, [weather]);

  // DATA RAMALAN BEBERAPA HARI KE DEPAN (FORECAST) - Fallback to mock if real data missing
  const nextDaysForecast = useMemo(() => {
    if (forecast && forecast.length > 0) {
      return forecast.slice(1, 5).map(f => ({
        day: f.day,
        temp: f.temp.toString(),
        cond: f.condition,
        icon: f.condition.toLowerCase().includes('rain') ? CloudRain : f.condition.toLowerCase().includes('clear') ? Sun : Cloud,
        hum: '70', // Open-Meteo current daily doesn't have humidity in the quick daily, can be added if needed
        wind: '14'
      }));
    }
    return [
      { day: 'Besok', temp: '31', cond: 'Partly Cloudy', icon: Cloud, hum: '70', wind: '14' },
      { day: 'Kamis', temp: '28', cond: 'Light Rain', icon: CloudRain, hum: '85', wind: '19' },
      { day: 'Jumat', temp: '27', cond: 'Thunderstorm', icon: CloudLightning, hum: '90', wind: '22' },
      { day: 'Sabtu', temp: '32', cond: 'Sunny Clear', icon: Sun, hum: '62', wind: '10' },
    ];
  }, [forecast]);

  // DATA LAPORAN TREN CUACA TERAKHIR (HISTORY REPORT)
  const pastDaysHistory = useMemo(() => {
    if (history7d && history7d.length > 0) {
      return history7d.map(h => ({
        date: h.date,
        temp: h.temp,
        cond: h.condition
      }));
    }
    return [
      { date: '16 Mei', temp: 33, cond: 'Sunny' },
      { date: '17 Mei', temp: 32, cond: 'Clear' },
      { date: '18 Mei', temp: 30, cond: 'Cloudy' },
      { date: '19 Mei (Hari Ini)', temp: 29, cond: 'Rain' },
    ];
  }, [history7d]);

  // RAINDROPS DATA (DETERMINISTIC BUT VARIED)
  const raindropData = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      left: `${(i * 13) % 100}%`,
      duration: 0.8 + ((i * 0.11) % 0.6),
      delay: (i * 0.17) % 2
    }));
  }, []);

  const getWeatherIcon = (conditionText: string) => {
    const cond = conditionText.toLowerCase();
    if (cond.includes('clear') || cond.includes('sun')) return <Sun className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />;
    if (cond.includes('rain') || cond.includes('drizzle')) return <CloudRain className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />;
    if (cond.includes('thunder')) return <CloudLightning className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />;
    return <Cloud className="w-6 h-6 md:w-8 md:h-8 text-slate-300" />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "glass-dark border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden text-white w-full group",
        className
      )}
    >
      {/* DYNAMIC WEATHER EFFECTS BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Sun Rays Effect */}
        {(currentDetails.condition.toLowerCase().includes('clear') || currentDetails.condition.toLowerCase().includes('sun')) && (
          <div className="absolute -top-10 -right-10 flex items-center justify-center">
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 90],
                opacity: [0.1, 0.2, 0.1]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="w-64 h-64 bg-yellow-500/20 rounded-full blur-[60px]"
            />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <motion.div
                key={angle}
                className="absolute w-1 h-32 bg-gradient-to-b from-yellow-400/20 to-transparent origin-bottom"
                initial={{ rotate: angle, opacity: 0 }}
                animate={{ opacity: [0, 0.3, 0], scaleY: [0.8, 1.2, 0.8] }}
                transition={{ duration: 4, repeat: Infinity, delay: angle / 90 }}
                style={{ top: '50%', left: '50%', marginTop: '-128px' }}
              />
            ))}
          </div>
        )}

        {/* Rain Drops Effect */}
        {(currentDetails.condition.toLowerCase().includes('rain') || currentDetails.condition.toLowerCase().includes('drizzle') || currentDetails.condition.toLowerCase().includes('thunder')) && (
          <div className="absolute inset-0">
            {raindropData.map((drop, i) => (
              <motion.div
                key={i}
                className="absolute w-[1px] h-4 bg-blue-400/30"
                initial={{ top: -20, left: drop.left, opacity: 0 }}
                animate={{ 
                  top: '120%', 
                  opacity: [0, 1, 0] 
                }}
                transition={{ 
                  duration: drop.duration, 
                  repeat: Infinity, 
                  delay: drop.delay,
                  ease: "linear"
                }}
              />
            ))}
          </div>
        )}

        {/* Cloud/Mist Effect */}
        {(currentDetails.condition.toLowerCase().includes('cloud') || currentDetails.condition.toLowerCase().includes('overcast') || currentDetails.condition.toLowerCase().includes('fog')) && (
          <div className="absolute inset-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-64 h-32 bg-white/5 rounded-full blur-[50px]"
                animate={{ 
                  x: [-100, 400],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ 
                  duration: 15 + i * 5, 
                  repeat: Infinity, 
                  delay: i * 3,
                  ease: "linear"
                }}
                style={{ top: `${20 + i * 25}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full"></div>
      
      {/* MENU HEADER & NAVIGATION TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5 relative z-20">
        <div>
          <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em]">{locationName || "Local"} Cluster</h3>
          <p className="text-sm font-bold text-slate-400 mt-0.5">Atmospheric Dynamics</p>
        </div>
        
        <div className="flex gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('current')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex-1 sm:flex-initial",
              activeTab === 'current' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            )}
          >
            Realtime
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex-1 sm:flex-initial flex items-center justify-center gap-1",
              activeTab === 'forecast' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            )}
          >
            <Calendar className="w-3 h-3" /> Forecast
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex-1 sm:flex-initial flex items-center justify-center gap-1",
              activeTab === 'history' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            )}
          >
            <History className="w-3 h-3" /> History
          </button>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-6">
        
        {/* TAB 1: CURRENT DATA REPORT (TAMPILAN ASLI JALAN) */}
        {activeTab === 'current' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  {getWeatherIcon(currentDetails.condition)}
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Local Condition</h3>
                  <p className="text-2xl font-black text-white">{currentDetails.condition}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-white tracking-tighter">{currentDetails.temperature}°C</p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Real Feel</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Humidity</p>
                  <p className="text-lg font-black text-white">{currentDetails.humidity}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Wind className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Wind Speed</p>
                  <p className="text-lg font-black text-white">{currentDetails.windSpeed} km/h</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Environment Impact Analysis</span>
              </div>
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-500",
                currentDetails.impactStatus === 'positive' ? "bg-emerald-500/10 border-emerald-500/20" :
                currentDetails.impactStatus === 'negative' ? "bg-red-500/10 border-red-500/20" :
                "bg-blue-500/5 border-white/10"
              )}>
                <p className="text-[11px] font-bold text-white leading-relaxed">
                  {currentDetails.effectOnPollution}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    currentDetails.impactStatus === 'positive' ? "bg-emerald-500" :
                    currentDetails.impactStatus === 'negative' ? "bg-red-500" : "bg-blue-400"
                  )} />
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-tighter",
                    currentDetails.impactStatus === 'positive' ? "text-emerald-400" :
                    currentDetails.impactStatus === 'negative' ? "text-red-400" : "text-blue-400"
                  )}>
                    {currentDetails.impactStatus === 'positive' ? "Cleansing Effect Active" :
                     currentDetails.impactStatus === 'negative' ? "Accumulation Risk High" : "Neutral Influence"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Wind className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Update Hari Ini (Hourly)</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {hourlyToday ? hourlyToday.map((h, i) => (
                  <div key={i} className="flex flex-col items-center bg-white/5 p-3 rounded-xl min-w-[70px]">
                    <span className="text-[9px] font-bold text-slate-500 mb-2">{h.time}</span>
                    <span className="text-sm font-black text-white">{h.temp}°</span>
                    <span className="text-[8px] text-slate-400 mt-1 whitespace-nowrap">{h.condition}</span>
                  </div>
                )) : (
                  <p className="text-[10px] font-medium text-slate-400 italic leading-relaxed">
                    "{currentDetails.effectOnPollution}"
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: MULTI-DAYS WEATHER FORECAST */}
        {activeTab === 'forecast' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {nextDaysForecast.map((item, idx) => {
              const CustomIcon = item.icon;
              return (
                <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center text-center hover:border-blue-500/30 transition-all">
                  <span className="text-[11px] text-slate-400 font-bold uppercase mb-3">{item.day}</span>
                  <div className="p-3 rounded-xl bg-slate-950/60 my-1">
                    <CustomIcon className="w-8 h-8 text-blue-400" />
                  </div>
                  <span className="text-xl font-black text-white mt-3">{item.temp}°C</span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1">{item.cond}</span>
                  <div className="flex justify-between w-full mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-500" /> {item.hum}%</span>
                    <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-teal-500" /> {item.wind}k</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: HISTORICAL TEMPERATURE REPORT */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Tren Suhu Udara Makro 4 Hari Terakhir</p>
            <div className="bg-black/20 border border-white/5 p-5 rounded-2xl space-y-4">
              {pastDaysHistory.map((hist, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-slate-300 font-medium">{hist.date}</span>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 text-slate-400 font-bold">{hist.cond}</span>
                    <div className="w-24 bg-white/5 h-2 rounded-full overflow-hidden hidden xs:block">
                      <div className="bg-gradient-to-r from-blue-500 to-orange-500 h-full" style={{ width: `${(hist.temp / 40) * 100}%` }}></div>
                    </div>
                    <span className="text-sm font-black text-orange-400 w-12 text-right">{hist.temp}°C</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
};