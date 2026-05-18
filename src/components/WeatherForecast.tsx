import React, { useState, useMemo } from 'react';
import { Cloud, Droplets, Wind, Sun, CloudRain, CloudLightning, Calendar, History } from 'lucide-react';
import { motion } from 'framer-motion'; // Mengubah 'motion/react' ke standar 'framer-motion' agar aman
import { cn } from '../lib/utils';

interface WeatherForecastProps {
  weather?: {
    temperature: string;
    humidity: string;
    windSpeed: string;
    windDirection: string;
    condition: string;
    effectOnPollution?: string;
  };
  className?: string;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({ weather, className }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'forecast' | 'history'>('current');

  // SAFE GUARD: Jika data dari App.tsx belum masuk, kita pasang data default agar aplikasi tidak crash
  const currentDetails = useMemo(() => {
    return {
      temperature: weather?.temperature || '29',
      humidity: weather?.humidity || '78',
      windSpeed: weather?.windSpeed || '12',
      condition: weather?.condition || 'Partly Cloudy',
      effectOnPollution: weather?.effectOnPollution || 'Moderate wind speeds are helping disperse PM2.5 accumulations near ground level.'
    };
  }, [weather]);

  // DATA RAMALAN BEBERAPA HARI KE DEPAN (FORECAST)
  const nextDaysForecast = [
    { day: 'Besok', temp: '31', cond: 'Partly Cloudy', icon: Cloud, hum: '70', wind: '14' },
    { day: 'Kamis', temp: '28', cond: 'Light Rain', icon: CloudRain, hum: '85', wind: '19' },
    { day: 'Jumat', temp: '27', cond: 'Thunderstorm', icon: CloudLightning, hum: '90', wind: '22' },
    { day: 'Sabtu', temp: '32', cond: 'Sunny Clear', icon: Sun, hum: '62', wind: '10' },
  ];

  // DATA LAPORAN TREN CUACA TERAKHIR (HISTORY REPORT)
  const pastDaysHistory = [
    { date: '16 Mei', temp: 33, cond: 'Sunny' },
    { date: '17 Mei', temp: 32, cond: 'Clear' },
    { date: '18 Mei', temp: 30, cond: 'Cloudy' },
    { date: '19 Mei (Hari Ini)', temp: 29, cond: 'Rain' },
  ];

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
        "glass-dark border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden text-white w-full",
        className
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full"></div>
      
      {/* MENU HEADER & NAVIGATION TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5 relative z-20">
        <div>
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Meteorological Report</h3>
          <p className="text-sm font-bold text-slate-400 mt-0.5">PantauLangit Dynamics Engine</p>
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
                  <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Local Condition</h3>
                  <p className="text-xl font-black text-white">{currentDetails.condition}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white tracking-tighter">{currentDetails.temperature}°C</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Real Feel</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Humidity</p>
                  <p className="text-sm font-black text-white">{currentDetails.humidity}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Wind Speed</p>
                  <p className="text-sm font-black text-white">{currentDetails.windSpeed} km/h</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Atmo-Dynamics Impact</span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 italic leading-relaxed">
                "{currentDetails.effectOnPollution}"
              </p>
            </div>
          </>
        )}

        {/* TAB 2: MULTI-DAYS WEATHER FORECAST */}
        {activeTab === 'forecast' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {nextDaysForecast.map((item, idx) => {
              const CustomIcon = item.icon;
              return (
                <div key={idx} className="bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-col items-center text-center hover:border-blue-500/30 transition-all">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-2">{item.day}</span>
                  <div className="p-2 rounded-xl bg-slate-950/60 my-1">
                    <CustomIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-lg font-black text-white mt-2">{item.temp}°C</span>
                  <span className="text-[9px] font-medium text-slate-500 mt-0.5">{item.cond}</span>
                  <div className="flex justify-between w-full mt-3 pt-2 border-t border-white/5 text-[9px] text-slate-400">
                    <span className="flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5 text-blue-500" /> {item.hum}%</span>
                    <span className="flex items-center gap-0.5"><Wind className="w-2.5 h-2.5 text-teal-500" /> {item.wind}k</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: HISTORICAL TEMPERATURE REPORT */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Tren Suhu Udara Makro 4 Hari Terakhir</p>
            <div className="bg-black/20 border border-white/5 p-4 rounded-2xl space-y-3">
              {pastDaysHistory.map((hist, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-slate-300 font-medium">{hist.date}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-bold">{hist.cond}</span>
                    <div className="w-20 bg-white/5 h-1.5 rounded-full overflow-hidden hidden xs:block">
                      <div className="bg-gradient-to-r from-blue-500 to-orange-500 h-full" style={{ width: `${(hist.temp / 40) * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-black text-orange-400 w-10 text-right">{hist.temp}°C</span>
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