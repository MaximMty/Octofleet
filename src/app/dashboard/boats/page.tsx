'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Anchor,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  MapPin,
  Plus,
  Search,
  Ship,
  UserCheck,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { ComplianceBadge } from '@/components/ui/StatusBadge';
import { ComplianceStatus, ComputedBoatSummary } from '@/types/domain';

export default function BoatsManagementPage() {
  const {
    currentUser,
    accessibleBoats,
    users,
    createOrUpdateBoat,
  } = useFleet();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBoatId, setEditingBoatId] = useState<string | undefined>(undefined);

  // Form state
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vesselClass, setVesselClass] = useState('50m Displacement Motor Yacht');
  const [lengthMeters, setLengthMeters] = useState(50);
  const [homePort, setHomePort] = useState('Port Hercule, Monaco');
  const [ownerId, setOwnerId] = useState('usr-owner-1');
  const [masterId, setMasterId] = useState('usr-master-1');
  const [coOwnerId, setCoOwnerId] = useState<string>('');
  const [specificationTier, setSpecificationTier] = useState('MCA LY3 Commercial Unrestricted');
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [googleWorksheetName, setGoogleWorksheetName] = useState('Inventory_2026');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const owners = useMemo(
    () => users.filter((u) => u.role === 'OWNER' && u.isActive),
    [users]
  );
  const masters = useMemo(
    () => users.filter((u) => u.role === 'MASTER' && u.isActive),
    [users]
  );

  const filteredBoats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleBoats.filter((b) => {
      const matchesQ =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.registrationNumber.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q) ||
        b.masterName.toLowerCase().includes(q) ||
        b.homePort.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || b.overallStatus === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [accessibleBoats, search, statusFilter]);

  const openCreateModal = () => {
    setEditingBoatId(undefined);
    setName('');
    setRegistrationNumber(`IMO-99${Math.floor(10000 + Math.random() * 89999)}`);
    setVesselClass('52m Displacement Motor Yacht');
    setLengthMeters(52);
    setHomePort('Port Hercule, Monaco');
    setOwnerId(owners[0]?.id || 'usr-owner-1');
    setMasterId(masters[0]?.id || 'usr-master-1');
    setCoOwnerId('');
    setSpecificationTier('MCA LY3 Commercial Unrestricted');
    setGoogleSheetId('');
    setGoogleWorksheetName('Master_Inventory');
    setDescription(
      'Commercial charter & private displacement superyacht configured with full SOLAS and galley inventory specifications.'
    );
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (boat: ComputedBoatSummary) => {
    setEditingBoatId(boat.id);
    setName(boat.name);
    setRegistrationNumber(boat.registrationNumber);
    setVesselClass(boat.vesselClass);
    setLengthMeters(boat.lengthMeters);
    setHomePort(boat.homePort);
    setOwnerId(boat.ownerId);
    setMasterId(boat.masterId);
    setCoOwnerId(boat.additionalOwnerIds?.[0] || '');
    setSpecificationTier(boat.specificationTier);
    setGoogleSheetId(boat.googleSheetId || '');
    setGoogleWorksheetName(boat.googleWorksheetName || 'Inventory');
    setDescription(boat.description);
    setFormError('');
    setModalOpen(true);
  };

  const handleBoatSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const res = createOrUpdateBoat({
      id: editingBoatId,
      name,
      registrationNumber,
      vesselClass,
      lengthMeters: Number(lengthMeters),
      homePort,
      ownerId,
      masterId,
      additionalOwnerIds: coOwnerId ? [coOwnerId] : [],
      specificationTier,
      googleSheetId: googleSheetId.trim() || undefined,
      googleWorksheetName: googleWorksheetName.trim() || undefined,
      description,
    });
    if (!res.ok) {
      setFormError(res.error || 'Could not save vessel profile.');
      return;
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Fleet & Vessel Profiles ({filteredBoats.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentUser.role === 'ADMIN'
              ? 'Manage boat registrations, assign owners & fleet masters, configure inventory specifications, and link Google Sheets.'
              : 'View vessels assigned to your clearance and inspect detailed onboard inventory compliance.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vessel, IMO, port..."
              className="pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <select
            aria-label="Filter vessels by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ComplianceStatus)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
          >
            <option value="ALL">All Compliance Statuses</option>
            <option value="MEETS_SPEC">Meets Specifications</option>
            <option value="ATTENTION">Needs Attention</option>
            <option value="CRITICAL">Critical Shortages</option>
          </select>

          {currentUser.role === 'ADMIN' && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              Register New Boat
            </button>
          )}
        </div>
      </div>

      {/* Vessel Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredBoats.map((boat) => (
          <div
            key={boat.id}
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
          >
            <div className="p-6">
              {/* Top Row: Name, IMO & Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-11 w-11 rounded-xl bg-[#0B132B] text-orange-400 flex items-center justify-center shrink-0">
                    <Ship className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/dashboard/boats/${boat.id}`}
                        className="text-base font-bold text-slate-950 hover:text-orange-600 transition-colors"
                      >
                        {boat.name}
                      </Link>
                      <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        {boat.registrationNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {boat.vesselClass} • {boat.lengthMeters}m LOA
                    </p>
                  </div>
                </div>
                <ComplianceBadge status={boat.overallStatus} />
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 mt-4 leading-relaxed">
                {boat.description}
              </p>

              {/* Metadata Grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Assigned Owner
                  </span>
                  <span className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {boat.ownerName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Assigned Master
                  </span>
                  <span className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                    <Anchor className="h-3.5 w-3.5 text-sky-600" />
                    {boat.masterName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Home Port
                  </span>
                  <span className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    {boat.homePort}
                  </span>
                </div>
              </div>

              {/* Specification & Google Sheets Connection Strip */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Spec Tier:</span>{' '}
                  <strong className="text-slate-800">{boat.specificationTier}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {boat.googleWorksheetName
                      ? `Sheet: ${boat.googleWorksheetName}`
                      : 'No Google Sheet linked'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Compliance Bar & Actions */}
            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Compliance:</span>{' '}
                  <strong className="text-slate-950 tabular-nums">
                    {boat.compliancePercentage}%
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Items:</span>{' '}
                  <strong className="text-slate-950 tabular-nums">
                    {boat.totalItems}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Below Spec:</span>{' '}
                  <strong
                    className={`tabular-nums ${
                      boat.lowStockItemsCount > 0
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {boat.lowStockItemsCount}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => openEditModal(boat)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Profile
                  </button>
                )}
                <Link
                  href={`/dashboard/boats/${boat.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B132B] hover:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  Open Inventory
                  <ExternalLink className="h-3.5 w-3.5 text-orange-400" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Boat Modal (Admin Only) */}
      {modalOpen && currentUser.role === 'ADMIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-slate-950">
              {editingBoatId ? 'Edit Vessel Profile' : 'Register New Vessel'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure hull identification, owner & master assignments, specification standard, and Google Sheets connection.
            </p>

            <form onSubmit={handleBoatSave} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Boat Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="M/Y Ocean Sovereign"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    IMO / Registration Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="IMO-9841201"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Vessel Class
                  </label>
                  <input
                    type="text"
                    value={vesselClass}
                    onChange={(e) => setVesselClass(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    LOA Length (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Home Port
                  </label>
                  <input
                    type="text"
                    value={homePort}
                    onChange={(e) => setHomePort(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Primary Owner
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Co-Owner (Optional)
                  </label>
                  <select
                    value={coOwnerId}
                    onChange={(e) => setCoOwnerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="">None</option>
                    {owners
                      .filter((o) => o.id !== ownerId)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.fullName}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Assigned Fleet Master
                  </label>
                  <select
                    value={masterId}
                    onChange={(e) => setMasterId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    {masters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Inventory Specification Tier
                  </label>
                  <input
                    type="text"
                    value={specificationTier}
                    onChange={(e) => setSpecificationTier(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Google Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    value={googleSheetId}
                    onChange={(e) => setGoogleSheetId(e.target.value)}
                    placeholder="1BxiMVs0XRA5nFMd..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Worksheet Tab Name
                  </label>
                  <input
                    type="text"
                    value={googleWorksheetName}
                    onChange={(e) => setGoogleWorksheetName(e.target.value)}
                    placeholder="Inventory_2026"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Vessel Description & Operational Notes
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {formError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600"
                >
                  {editingBoatId ? 'Save Changes' : 'Register Vessel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
