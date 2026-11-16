'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  Radar,
  Search,
  Ship,
  X,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { ComputedBoatSummary } from '@/types/domain';
import WindyWeatherWidget, {
  FALLBACK_PORT,
  findPortsForHomePort,
} from '@/components/weather/WindyWeatherWidget';

/* ============================================================================
 * Live Yacht Tracker
 *
 * Lists the vessels the current user can access. Selecting one loads the
 * official MarineTraffic embeddable AIS map, locked onto that vessel's MMSI.
 * If a vessel has no MMSI yet, the map shows live traffic around its home port.
 * ========================================================================== */

function buildMarineTrafficEmbedUrl(opts: {
  mmsi?: string;
  lat: number;
  lon: number;
  zoom: number;
  mapType: number;
  showNames: boolean;
}) {
  const segments = [
    `zoom:${opts.zoom}`,
    `centery:${opts.lat.toFixed(4)}`,
    `centerx:${opts.lon.toFixed(4)}`,
    `maptype:${opts.mapType}`,
    `shownames:${opts.showNames}`,
    `mmsi:${opts.mmsi || 0}`,
    'shipid:0',
    'fleet:',
    'fleet_id:',
    'vtypes:',
    'showmenu:false',
    'remember:false',
  ];
  return `https://www.marinetraffic.com/en/ais/embed/${segments.join('/')}`;
}

function marineTrafficDetailsUrl(boat: ComputedBoatSummary) {
  if (boat.mmsi) return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${boat.mmsi}`;
  const imo = boat.registrationNumber.replace(/\D/g, '');
  if (imo.length === 7) return `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`;
  return `https://www.marinetraffic.com/en/ais/home`;
}

function TrackerContent() {
  const { accessibleBoats, currentUser, updateBoatMmsi } = useFleet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAdmin = currentUser.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(
    searchParams.get('boat') ?? undefined
  );
  const [editingMmsi, setEditingMmsi] = useState(false);
  const [mmsiDraft, setMmsiDraft] = useState('');
  const [mmsiError, setMmsiError] = useState('');
  const [mapType, setMapType] = useState<number>(0);
  const [showNames, setShowNames] = useState<boolean>(true);

  const filteredBoats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accessibleBoats;
    return accessibleBoats.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.homePort.toLowerCase().includes(q) ||
        (b.mmsi ?? '').includes(q) ||
        b.registrationNumber.toLowerCase().includes(q)
    );
  }, [accessibleBoats, search]);

  const selectedBoat =
    accessibleBoats.find((b) => b.id === selectedId) ?? accessibleBoats[0];

  // Keep URL in sync so a tracked vessel can be shared / bookmarked.
  useEffect(() => {
    if (!selectedBoat) return;
    if (searchParams.get('boat') !== selectedBoat.id) {
      router.replace(`/dashboard/tracker?boat=${selectedBoat.id}`, { scroll: false });
    }
  }, [selectedBoat, searchParams, router]);

  // Reset inline editor when switching vessels.
  useEffect(() => {
    setEditingMmsi(false);
    setMmsiError('');
    setMmsiDraft(selectedBoat?.mmsi ?? '');
  }, [selectedBoat?.id, selectedBoat?.mmsi]);

  if (!selectedBoat) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
        <Ship className="h-8 w-8 text-slate-500 mx-auto" />
        <p className="text-sm text-slate-300 mt-3 font-semibold">No vessels assigned to your clearance.</p>
      </div>
    );
  }

  const port = findPortsForHomePort(selectedBoat.homePort)[0] ?? FALLBACK_PORT;
  const embedUrl = buildMarineTrafficEmbedUrl({
    mmsi: selectedBoat.mmsi,
    lat: port.lat,
    lon: port.lon,
    zoom: selectedBoat.mmsi ? 10 : 11,
    mapType,
    showNames,
  });

  const saveMmsi = () => {
    const res = updateBoatMmsi(selectedBoat.id, mmsiDraft);
    if (!res.ok) {
      setMmsiError(res.error || 'Could not save MMSI.');
      return;
    }
    setEditingMmsi(false);
    setMmsiError('');
  };

  const trackedCount = accessibleBoats.filter((b) => b.mmsi).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Radar className="h-5 w-5 text-orange-400" />
            Live Yacht Tracker
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AIS
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select a vessel to view its live AIS position on MarineTraffic. {trackedCount} of{' '}
            {accessibleBoats.length} vessels linked to an MMSI.
          </p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search yacht, port, MMSI..."
            className="pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0A1122] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 w-full md:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Vessel list */}
        <div className="xl:col-span-4 space-y-3 xl:max-h-[calc(100vh-15rem)] xl:overflow-y-auto xl:pr-1">
          {filteredBoats.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-xs text-slate-400">
              No vessels match “{search}”.
            </div>
          )}
          {filteredBoats.map((boat) => {
            const active = boat.id === selectedBoat.id;
            return (
              <button
                key={boat.id}
                onClick={() => setSelectedId(boat.id)}
                className={`w-full text-left flex items-stretch gap-3 rounded-xl border p-2.5 transition-all ${
                  active
                    ? 'border-orange-500 bg-orange-500/10 shadow-md'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/70'
                }`}
              >
                <div className="h-20 w-28 shrink-0 rounded-lg overflow-hidden bg-slate-800">
                  <img
                    src={boat.imageUrl || '/boats/sovereign.jpg'}
                    alt={boat.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 py-0.5 flex flex-col justify-between">
                  <div>
                    <p className={`text-sm font-bold truncate ${active ? 'text-orange-300' : 'text-white'}`}>
                      {boat.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {boat.vesselClass} • {boat.lengthMeters}m
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 truncate">
                      <MapPin className="h-3 w-3 text-orange-400 shrink-0" />
                      <span className="truncate">{boat.homePort}</span>
                    </span>
                    {boat.mmsi ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 shrink-0">
                        <Navigation className="h-2.5 w-2.5" />
                        LIVE
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 shrink-0">
                        NO MMSI
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Map panel */}
        <div className="xl:col-span-8 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">{selectedBoat.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="font-mono">{selectedBoat.registrationNumber}</span>
                {!editingMmsi && (
                  <span className="inline-flex items-center gap-1.5">
                    MMSI:{' '}
                    <strong className="font-mono text-slate-200">
                      {selectedBoat.mmsi || 'not set'}
                    </strong>
                    {isAdmin && (
                      <button
                        onClick={() => setEditingMmsi(true)}
                        className="text-orange-400 hover:text-orange-300"
                        title="Edit MMSI"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )}
                {editingMmsi && (
                  <span className="inline-flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={mmsiDraft}
                      onChange={(e) => setMmsiDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveMmsi();
                        if (e.key === 'Escape') setEditingMmsi(false);
                      }}
                      placeholder="9-digit MMSI"
                      inputMode="numeric"
                      maxLength={11}
                      className="w-32 rounded-md border border-slate-700 bg-[#0A1122] px-2 py-1 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={saveMmsi}
                      className="p-1 rounded-md bg-orange-500 text-white hover:bg-orange-600"
                      title="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setEditingMmsi(false)}
                      className="p-1 rounded-md border border-slate-700 text-slate-400 hover:text-white"
                      title="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              {mmsiError && <p className="text-[11px] text-rose-400 mt-1">{mmsiError}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="flex rounded-lg border border-slate-700 bg-[#0A1122] p-0.5">
                {[
                  { id: 0, label: 'Standard' },
                  { id: 1, label: 'Satellite' },
                  { id: 2, label: 'Nautical / OSM' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMapType(m.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      mapType === m.id
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowNames((v) => !v)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  showNames
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-[#0A1122] text-slate-400 hover:text-white'
                }`}
              >
                Labels: {showNames ? 'On' : 'Off'}
              </button>
              <Link
                href={`/dashboard/boats/${selectedBoat.id}`}
                className="text-xs font-semibold text-slate-300 hover:text-white px-2"
              >
                Vessel profile
              </Link>
              <a
                href={marineTrafficDetailsUrl(selectedBoat)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 px-3 py-1.5 text-xs font-bold text-white"
              >
                Open on MarineTraffic <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {!selectedBoat.mmsi && (
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-px" />
              <span>
                No MMSI linked — showing live traffic around {port.label}.
                {isAdmin
                  ? ' Click the pencil icon above to add the yacht’s 9-digit MMSI and lock the map onto it.'
                  : ' Ask a fleet administrator to add this yacht’s MMSI.'}
              </span>
            </div>
          )}

          <div className="relative w-full flex-1 min-h-[480px] xl:min-h-[560px] bg-[#0A1122]">
            <iframe
              key={embedUrl}
              title={`MarineTraffic live map — ${selectedBoat.name}`}
              src={embedUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              allowFullScreen
            />
          </div>

          <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500">
            AIS data © MarineTraffic. Positions depend on the vessel’s AIS transponder and terrestrial
            / satellite coverage and may be delayed.
          </div>
        </div>
      </div>

      {/* Live Marine Weather for the selected yacht */}
      <WindyWeatherWidget
        boats={accessibleBoats}
        focusHomePort={selectedBoat.homePort}
        title={`Live Marine Weather — ${selectedBoat.name} (${selectedBoat.homePort})`}
      />
    </div>
  );
}

export default function YachtTrackerPage() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400">Loading tracker…</div>}>
      <TrackerContent />
    </Suspense>
  );
}
