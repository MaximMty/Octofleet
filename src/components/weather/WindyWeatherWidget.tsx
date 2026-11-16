'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, ExternalLink, MapPin } from 'lucide-react';

/* ============================================================================
 * Windy.com live marine weather widget
 *
 * Uses Windy's official, free embed (embed.windy.com) rather than scraping
 * their site. The iframe renders live ECMWF/GFS model data (wind, gusts,
 * waves, swell, rain, temperature, pressure) with Windy's own animated map.
 * ========================================================================== */

export interface PortLocation {
  key: string;
  label: string;
  lat: number;
  lon: number;
  /** Lower-case substrings used to match a boat's free-text `homePort`. */
  matchers: string[];
}

/** Known home ports. Add new entries here as the fleet grows. */
const KNOWN_PORTS: PortLocation[] = [
  { key: 'monaco', label: 'Port Hercule, Monaco', lat: 43.7347, lon: 7.4206, matchers: ['monaco', 'hercule'] },
  { key: 'porto-cervo', label: 'Porto Cervo, Sardinia', lat: 41.1352, lon: 9.532, matchers: ['porto cervo', 'sardinia'] },
  { key: 'palma', label: 'Palma de Mallorca', lat: 39.5667, lon: 2.638, matchers: ['palma', 'mallorca', 'majorca'] },
  { key: 'antibes', label: 'Port Vauban, Antibes', lat: 43.585, lon: 7.1285, matchers: ['antibes', 'vauban'] },
  { key: 'tromso', label: 'Tromsø, Norway', lat: 69.6496, lon: 18.956, matchers: ['tromsø', 'tromso'] },
  { key: 'nice', label: 'Nice, France', lat: 43.6947, lon: 7.2853, matchers: ['nice'] },
  { key: 'cannes', label: 'Cannes, France', lat: 43.5513, lon: 7.0128, matchers: ['cannes'] },
  { key: 'st-tropez', label: 'Saint-Tropez, France', lat: 43.2727, lon: 6.6406, matchers: ['tropez'] },
  { key: 'ibiza', label: 'Ibiza, Spain', lat: 38.9089, lon: 1.4349, matchers: ['ibiza'] },
  { key: 'barcelona', label: 'Barcelona, Spain', lat: 41.3758, lon: 2.1828, matchers: ['barcelona'] },
];

export const FALLBACK_PORT: PortLocation = {
  key: 'west-med',
  label: 'Western Mediterranean',
  lat: 41.5,
  lon: 6.5,
  matchers: [],
};

const LAYERS = [
  { id: 'wind', label: 'Wind' },
  { id: 'gust', label: 'Gusts' },
  { id: 'waves', label: 'Waves' },
  { id: 'swell1', label: 'Swell' },
  { id: 'rain', label: 'Rain' },
  { id: 'temp', label: 'Temp' },
  { id: 'pressure', label: 'Pressure' },
] as const;

type LayerId = (typeof LAYERS)[number]['id'];

export function findPortsForHomePort(homePort: string): PortLocation[] {
  const hp = homePort.toLowerCase();
  return KNOWN_PORTS.filter((p) => p.matchers.some((m) => hp.includes(m)));
}

interface WindyWeatherWidgetProps {
  /** Boats whose home ports should be selectable in the widget. */
  boats: { id: string; name: string; homePort: string }[];
  /** Optional home port to focus on (e.g. the Owner's currently selected vessel). */
  focusHomePort?: string;
  title?: string;
}

export default function WindyWeatherWidget({
  boats,
  focusHomePort,
  title = 'Live Marine Weather',
}: WindyWeatherWidgetProps) {
  // Build a de-duplicated list of ports from the boats' home ports.
  const stations = useMemo(() => {
    const map = new Map<string, PortLocation & { boatNames: string[] }>();
    for (const boat of boats) {
      for (const port of findPortsForHomePort(boat.homePort)) {
        const existing = map.get(port.key);
        if (existing) {
          if (!existing.boatNames.includes(boat.name)) existing.boatNames.push(boat.name);
        } else {
          map.set(port.key, { ...port, boatNames: [boat.name] });
        }
      }
    }
    const list = Array.from(map.values());
    return list.length > 0 ? list : [{ ...FALLBACK_PORT, boatNames: [] as string[] }];
  }, [boats]);

  const focusKey = useMemo(() => {
    if (!focusHomePort) return undefined;
    return findPortsForHomePort(focusHomePort)[0]?.key;
  }, [focusHomePort]);

  const [stationKey, setStationKey] = useState<string>(focusKey ?? stations[0].key);
  const [layer, setLayer] = useState<LayerId>('wind');

  // Follow the focused vessel when it changes (Owner vessel switcher).
  useEffect(() => {
    if (focusKey) setStationKey(focusKey);
  }, [focusKey]);

  const station = stations.find((s) => s.key === stationKey) ?? stations[0];

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      type: 'map',
      location: 'coordinates',
      lat: station.lat.toFixed(4),
      lon: station.lon.toFixed(4),
      detailLat: station.lat.toFixed(4),
      detailLon: station.lon.toFixed(4),
      zoom: '8',
      level: 'surface',
      overlay: layer,
      menu: '',
      message: 'true',
      marker: 'true',
      calendar: 'now',
      pressure: 'true',
      detail: 'true',
      metricWind: 'kt',
      metricTemp: '°C',
      metricRain: 'mm',
      radarRange: '-1',
    });
    return `https://embed.windy.com/embed.html?${params.toString()}`;
  }, [station.lat, station.lon, layer]);

  const windyLink = `https://www.windy.com/?${layer},${station.lat.toFixed(3)},${station.lon.toFixed(3)},9`;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CloudSun className="h-4.5 w-4.5 text-sky-400" />
            {title}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {station.label}
            {station.boatNames.length > 0 && (
              <span className="text-slate-500"> • {station.boatNames.join(', ')}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stations.length > 1 && (
            <select
              aria-label="Select port for weather"
              value={station.key}
              onChange={(e) => setStationKey(e.target.value)}
              className="text-xs rounded-lg border border-slate-700 px-2.5 py-1.5 bg-[#0A1122] font-medium text-slate-200"
            >
              {stations.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap rounded-lg border border-slate-700 bg-[#0A1122] p-0.5">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayer(l.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  layer === l.id
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <a
            href={windyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300"
          >
            Open in Windy <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="relative w-full h-[420px] bg-[#0A1122]">
        <iframe
          key={embedUrl}
          title={`Windy live weather — ${station.label}`}
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  );
}
