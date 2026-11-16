'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Boxes,
  Download,
  FileSpreadsheet,
  History,
  Lock,
  Plus,
  Search,
  Ship,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import {
  ComplianceBadge,
  MovementTypeBadge,
  RestockStatusBadge,
} from '@/components/ui/StatusBadge';
import { exportToCsv } from '@/lib/csv-export';
import { ComplianceStatus, MovementType } from '@/types/domain';

export default function BoatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: boatId } = use(params);
  const {
    currentUser,
    canAccessBoatId,
    getBoatById,
    getBoatInventory,
    accessibleMovements,
    accessibleRestockRequests,
    categories,
    recordStockMovement,
    submitRestockRequest,
    createOrUpdateInventoryItem,
  } = useFleet();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL');

  // Modals
  const [movementModalItemId, setMovementModalItemId] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('ADDED');
  const [movementQty, setMovementQty] = useState<number>(5);
  const [movementReason, setMovementReason] = useState<string>('');
  const [movementRef, setMovementRef] = useState<string>('');
  const [movementError, setMovementError] = useState<string>('');

  const [restockModalItemId, setRestockModalItemId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockPriority, setRestockPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('HIGH');
  const [restockReason, setRestockReason] = useState<string>('');

  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('cat-prov');
  const [newUnit, setNewUnit] = useState('units');
  const [newCurrentQty, setNewCurrentQty] = useState(10);
  const [newRequiredQty, setNewRequiredQty] = useState(20);
  const [newMinWarningQty, setNewMinWarningQty] = useState(12);
  const [newDescription, setNewDescription] = useState('');

  // Enforce strict Owner & Master boat isolation (Backend/RLS rule)
  const hasAccess = canAccessBoatId(boatId);
  const boat = getBoatById(boatId);
  const boatItems = useMemo(() => getBoatInventory(boatId), [boatId, getBoatInventory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boatItems.filter((item) => {
      const matchesQ =
        !q ||
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'ALL' || item.categoryId === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesQ && matchesCat && matchesStatus;
    });
  }, [boatItems, search, categoryFilter, statusFilter]);

  const boatMovements = useMemo(
    () => accessibleMovements.filter((m) => m.boatId === boatId),
    [accessibleMovements, boatId]
  );

  const boatRestocks = useMemo(
    () => accessibleRestockRequests.filter((r) => r.boatId === boatId),
    [accessibleRestockRequests, boatId]
  );

  if (!hasAccess || !boat) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs">
        <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-950">
          Access Restricted by Supabase RLS & Role Policy
        </h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Your active account (<strong>{currentUser.fullName}</strong> —{' '}
          <strong>{currentUser.role}</strong>) does not have authorization to access vessel{' '}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded">{boatId}</code>. Owners and Fleet Masters may only view vessels explicitly assigned to their clearance.
        </p>
        <Link
          href="/dashboard/boats"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0B132B] px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Authorized Vessels
        </Link>
      </div>
    );
  }

  const handleOpenMovementModal = (itemId: string) => {
    setMovementModalItemId(itemId);
    setMovementType('ADDED');
    setMovementQty(5);
    setMovementReason('Routine Onboard Stock Replenishment / Log Update');
    setMovementRef(`LOG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`);
    setMovementError('');
  };

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementModalItemId) return;
    const res = recordStockMovement({
      boatInventoryId: movementModalItemId,
      movementType,
      quantity: Number(movementQty),
      reason: movementReason,
      referenceCode: movementRef,
    });
    if (!res.ok) {
      setMovementError(res.error || 'Failed to record stock movement.');
      return;
    }
    setMovementModalItemId(null);
  };

  const handleOpenRestockModal = (itemId: string) => {
    const item = boatItems.find((i) => i.id === itemId);
    setRestockModalItemId(itemId);
    setRestockQty(item && item.missingQty > 0 ? item.missingQty : 10);
    setRestockPriority(item?.status === 'CRITICAL' ? 'URGENT' : 'HIGH');
    setRestockReason(
      item
        ? `Replenish ${item.productName} to required specification (${item.requiredQty} ${item.unit}).`
        : 'Replenish stock to required vessel specification.'
    );
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModalItemId) return;
    const res = submitRestockRequest({
      boatInventoryId: restockModalItemId,
      requestedQty: Number(restockQty),
      priority: restockPriority,
      reason: restockReason,
    });
    if (res.ok) {
      setRestockModalItemId(null);
    }
  };

  const handleCreateItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === newCategoryId) || categories[0];
    const res = createOrUpdateInventoryItem({
      boatId: boat.id,
      sku: newSku,
      productName: newName,
      categoryId: cat.id,
      categoryName: cat.name,
      description: newDescription,
      unit: newUnit,
      currentQty: Number(newCurrentQty),
      requiredQty: Number(newRequiredQty),
      minWarningQty: Number(newMinWarningQty),
    });
    if (res.ok) {
      setAddItemModalOpen(false);
    }
  };

  const handleExportBoatCsv = () => {
    exportToCsv(
      `${boat.name.replace(/\s+/g, '_')}_Detailed_Inventory.csv`,
      [
        'Vessel Name',
        'IMO Number',
        'SKU',
        'Product Name',
        'Category',
        'Current Quantity',
        'Required Quantity',
        'Missing Quantity',
        'Min Warning Qty',
        'Unit',
        'Compliance Status',
        'Last Updated',
      ],
      boatItems.map((i) => [
        boat.name,
        boat.registrationNumber,
        i.sku,
        i.productName,
        i.categoryName,
        i.currentQty,
        i.requiredQty,
        i.missingQty,
        i.minWarningQty,
        i.unit,
        i.status,
        i.lastUpdatedAt,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Vessel Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/boats"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-orange-600 mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Fleet Registry
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-10 w-10 rounded-xl bg-[#0B132B] text-orange-400 flex items-center justify-center">
                <Ship className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-950">{boat.name}</h2>
                  <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {boat.registrationNumber}
                  </span>
                  <ComplianceBadge status={boat.overallStatus} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {boat.vesselClass} • Home Port: {boat.homePort} • Owner: {boat.ownerName} • Master:{' '}
                  {boat.masterName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportBoatCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
            >
              <Download className="h-4 w-4 text-slate-600" />
              Export CSV Report
            </button>
            {currentUser.role === 'ADMIN' && (
              <>
                <Link
                  href="/dashboard/integrations"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Sheet Sync ({boat.googleWorksheetName || 'Configure'})
                </Link>
                <button
                  onClick={() => {
                    setNewSku(`PRV-NEW-${Math.floor(100 + Math.random() * 899)}`);
                    setNewName('');
                    setNewDescription('');
                    setAddItemModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add Spec Item
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Specification Compliance
            </span>
            <p className="text-2xl font-bold text-slate-950 mt-1 tabular-nums">
              {boat.compliancePercentage}%
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Total Tracked Items
            </span>
            <p className="text-2xl font-bold text-slate-950 mt-1 tabular-nums">
              {boat.totalItems}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Items Below Spec
            </span>
            <p className="text-2xl font-bold text-rose-600 mt-1 tabular-nums">
              {boat.lowStockItemsCount}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Spec Standard
            </span>
            <p className="text-sm font-bold text-slate-900 mt-2 truncate">
              {boat.specificationTier}
            </p>
          </div>
        </div>
      </div>

      {/* Prominent Item Warnings Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Onboard Stock vs. Required Specification Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {boatItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border px-3.5 py-2.5 text-xs flex items-center justify-between ${
                item.missingQty > 0
                  ? 'border-amber-300 bg-amber-50/50 text-slate-900'
                  : 'border-emerald-200 bg-emerald-50/40 text-slate-900'
              }`}
            >
              <div>
                <span className="font-bold">{item.productName}:</span>{' '}
                <span className="tabular-nums font-semibold">
                  {item.currentQty} / {item.requiredQty} {item.unit}
                </span>{' '}
                <span
                  className={
                    item.missingQty > 0
                      ? 'text-rose-700 font-bold'
                      : 'text-emerald-700 font-semibold'
                  }
                >
                  {item.missingQty > 0
                    ? `(${item.missingQty} missing)`
                    : '(Meets requirements)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Boat Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              {boat.name} — Inventory Specification & Stock Table
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Missing quantity is calculated automatically: MAX(Required − Current, 0)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU or product..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white font-medium"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ComplianceStatus)}
              className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="MEETS_SPEC">Meets Specifications</option>
              <option value="ATTENTION">Needs Attention</option>
              <option value="CRITICAL">Critical Shortages</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Product & SKU</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Current Qty</th>
                <th className="py-3.5 px-4 text-right">Required Qty</th>
                <th className="py-3.5 px-4 text-right">Missing Qty</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {item.sku} • {item.description}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">
                    {item.categoryName}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold tabular-nums text-slate-900">
                    {item.currentQty} {item.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-slate-700">
                    {item.requiredQty} {item.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    {item.missingQty > 0 ? (
                      <span className="font-bold text-rose-600">
                        {item.missingQty} {item.unit}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <ComplianceBadge status={item.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 tabular-nums">
                    <div>{new Date(item.lastUpdatedAt).toLocaleString()}</div>
                    <div className="text-[11px] text-slate-400">by {item.lastUpdatedBy}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {currentUser.role !== 'OWNER' && (
                        <button
                          onClick={() => handleOpenMovementModal(item.id)}
                          className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold"
                        >
                          Log Movement
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenRestockModal(item.id)}
                        className="rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 px-2.5 py-1 text-[11px] font-bold"
                      >
                        Restock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Vessel Stock Movement History & Vessel Restock Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-orange-500" />
            Vessel Stock Movement History ({boatMovements.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {boatMovements.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No movements recorded yet.</p>
            ) : (
              boatMovements.map((mov) => (
                <div
                  key={mov.id}
                  className="py-3 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type={mov.movementType} />
                      <span className="font-bold text-slate-900">{mov.productName}</span>
                    </div>
                    <p className="text-slate-600 mt-1">{mov.reason}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      By {mov.performedByName} • {new Date(mov.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <span
                      className={`font-bold ${
                        mov.deltaQty >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {mov.deltaQty >= 0 ? `+${mov.deltaQty}` : mov.deltaQty} {mov.unit}
                    </span>
                    <div className="text-[11px] text-slate-400">
                      {mov.previousQty} → {mov.newQty}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2 mb-4">
            <Boxes className="h-4 w-4 text-orange-500" />
            Vessel Restock Requests ({boatRestocks.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {boatRestocks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No restock requests submitted for this vessel.
              </p>
            ) : (
              boatRestocks.map((req) => (
                <div
                  key={req.id}
                  className="py-3 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">
                        {req.requestCode}
                      </span>
                      <span className="font-bold text-slate-900">{req.productName}</span>
                      <RestockStatusBadge status={req.status} />
                    </div>
                    <p className="text-slate-600 mt-1">{req.reason}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Requested by {req.requestedByName} •{' '}
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right font-bold tabular-nums text-slate-900 shrink-0">
                    +{req.requestedQty} {req.unit}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Record Stock Movement (Admin/Master) */}
      {movementModalItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">Record Stock Movement</h3>
            <p className="text-xs text-slate-500 mt-1">
              Every change is logged in the immutable stock movement ledger.
            </p>
            <form onSubmit={handleMovementSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Movement Type
                </label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as MovementType)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  <option value="ADDED">Stock Added (+)</option>
                  <option value="REMOVED">Stock Removed / Consumed (−)</option>
                  <option value="ADJUSTED">Stock Audit Adjusted (Exact New Qty)</option>
                  <option value="TRANSFERRED">Stock Transferred Off-Vessel (⇄)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  {movementType === 'ADJUSTED' ? 'New Audited Quantity' : 'Quantity'}
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={movementQty}
                  onChange={(e) => setMovementQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Reason / Voyage Reference *
                </label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              {movementError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                  {movementError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovementModalItemId(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold"
                >
                  Commit Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submit Restock Request */}
      {restockModalItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">Submit Restock Request</h3>
            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Requested Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Priority
                </label>
                <select
                  value={restockPriority}
                  onChange={(e) =>
                    setRestockPriority(e.target.value as 'NORMAL' | 'HIGH' | 'URGENT')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Reason
                </label>
                <textarea
                  rows={3}
                  required
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModalItemId(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Specification Item (Admin Only) */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              Add Inventory Specification Item — {boat.name}
            </h3>
            <form onSubmit={handleCreateItemSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Spare Bilge Pump"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Unit of Measurement
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Current Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newCurrentQty}
                    onChange={(e) => setNewCurrentQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Required Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newRequiredQty}
                    onChange={(e) => setNewRequiredQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Min Warning Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMinWarningQty}
                    onChange={(e) => setNewMinWarningQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddItemModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
