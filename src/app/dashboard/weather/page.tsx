'use client';

import React, { useState } from 'react';
import { CloudSun, MapPin, Ship } from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import WindyWeatherWidget from '@/components/weather/WindyWeatherWidget';

export default function WeatherPage() {
  const { accessibleBoats } = useFleet();
  const [selectedBoatId, setSelectedBoatId] = useState<string>(
    accessibleBoats[0]?.id ?? ''
  );

  const selectedBoat =
    accessibleBoats.find((b) => b.id === selectedBoatId) ?? accessibleBoats[0];

  return (
    <div className="space-y-6">
      {/* Header & Quick Vessel Selector */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-sky-400" />
            Live Marine Weather (Windy)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time ECMWF/GFS wind, gusts, waves, swell, rain, temperature, and barometric pressure across fleet home ports.
          </p>
        </div>

        {accessibleBoats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Ship className="h-3.5 w-3.5 text-orange-400" />
              Focus Vessel:
            </span>
            {accessibleBoats.map((boat) => {
              const active = selectedBoat?.id === boat.id;
              return (
                <button
                  key={boat.id}
                  onClick={() => setSelectedBoatId(boat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-orange-500 text-white'
                      : 'bg-[#0A1122] border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span>{boat.name}</span>
                  <span className="text-[10px] opacity-80 flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {boat.homePort.split(',')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Windy Live Map */}
      <WindyWeatherWidget
        boats={accessibleBoats}
        focusHomePort={selectedBoat?.homePort}
        title={
          selectedBoat
            ? `Windy Live Marine Forecast — ${selectedBoat.name} (${selectedBoat.homePort})`
            : 'Windy Live Marine Forecast'
        }
      />
    </div>
  );
}
