import React from 'react';
import { Cloud, Droplets, Wind, Sun, CloudRain, CloudLightning } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface WeatherForecastProps {
  weather: {
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
  const getWeatherIcon = () => {
    const cond = weather.condition.toLowerCase();
    if (cond.includes('clear') || cond.includes('sun')) return <Sun className="w-8 h-8 text-yellow-400" />;
    if (cond.includes('rain') || cond.includes('drizzle')) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (cond.includes('thunder')) return <CloudLightning className="w-8 h-8 text-purple-400" />;
    return <Cloud className="w-8 h-8 text-slate-300" />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "glass-dark border border-white/5 p-6 rounded-[2rem] relative overflow-hidden",
        className
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full"></div>
      
      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              {getWeatherIcon()}
            </div>
            <div>
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Local Forecast</h3>
              <p className="text-xl font-black text-white">{weather.condition}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-white tracking-tighter">{weather.temperature}°C</p>
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
              <p className="text-sm font-black text-white">{weather.humidity}%</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Wind Speed</p>
              <p className="text-sm font-black text-white">{weather.windSpeed}k</p>
            </div>
          </div>
        </div>

        {weather.effectOnPollution && (
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-3 h-3 text-blue-400" />
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Atmo-Dynamics Impact</span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 italic leading-relaxed">
              "{weather.effectOnPollution}"
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
