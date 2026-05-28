import React, { useEffect } from 'react';
import { MapPin, User } from 'lucide-react';

interface RealTimeMapProps {
  destinations?: { id: string; lat: number; lng: number; label?: string }[];
  onDistancesCalculated?: (results: { id: string; distance: string; duration: string }[]) => void;
  className?: string;
}

export const RealTimeMap: React.FC<RealTimeMapProps> = ({ 
  destinations = [], 
  onDistancesCalculated,
  className 
}) => {
  useEffect(() => {
    if (destinations.length > 0 && onDistancesCalculated) {
      // Simulate real-time distance calculation
      const results = destinations.map((d, index) => ({
        id: d.id,
        distance: `${(index + 1) * 2.5} km`,
        duration: `${(index + 1) * 5 + 3} mins`
      }));
      
      const timer = setTimeout(() => {
        onDistancesCalculated(results);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [destinations, onDistancesCalculated]);

  return (
    <div className={`${className} bg-slate-50 dark:bg-slate-900 overflow-hidden relative`}>
      {/* Grid Pattern Background to look like a map */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      
      {/* Schematic Road Lines */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 w-full h-1 bg-slate-200/50 dark:bg-slate-700/50 -translate-y-1/2 rotate-12" />
        <div className="absolute left-1/2 h-full w-1 bg-slate-200/50 dark:bg-slate-700/50 -translate-x-1/2 -rotate-12" />
        <div className="absolute top-1/4 w-full h-1 bg-slate-200/50 dark:bg-slate-700/50 -rotate-3" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        {/* User Marker */}
        <div className="relative z-10">
          <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center animate-ping absolute -inset-0" />
          <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center relative border-4 border-blue-600">
            <User className="text-blue-600 w-6 h-6" />
          </div>
        </div>

        {/* Destination Markers */}
        {destinations.map((dest, i) => {
          // Spread them out visually
          const angle = (i / destinations.length) * 2 * Math.PI;
          const radius = 100 + i * 20;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div 
              key={dest.id}
              className="absolute transition-all duration-1000 ease-out"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <div className="flex flex-col items-center gap-1 group">
                <div className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {dest.label}
                </div>
                <div className="w-8 h-8 bg-red-500 rounded-full shadow-lg flex items-center justify-center text-white">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map Attribution Simulation */}
      <div className="absolute bottom-2 right-2 bg-white/50 dark:bg-slate-900/50 px-2 py-0.5 rounded text-[8px] text-slate-400 backdrop-blur-sm">
        LifeLine Live Map Engine
      </div>
    </div>
  );
};
