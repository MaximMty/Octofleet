'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  Boxes,
  Download,
  Edit3,
  History,
  Plus,
  Search,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import {
  ComplianceBadge,
  MovementTypeBadge,
} from '@/components/ui/StatusBadge';
import { exportToCsv } from '@/lib/csv-export';
import {
  ComplianceStatus,
  ComputedInventoryItem,
  MovementType,
} from '@/types/domain';

export default function InventoryManagementPage() {
  const {
    currentUser,
    accessibleBoats,
    accessibleInventory,
    accessibleMovements,
    categories,
    createOrUpdateInventoryItem,
    recordStockMovement,
    submitRestockRequest,
  } = useFleet();

  const [activeTab, setActiveTab] = useState<'STOCK' | 'MOVEMENTS'>('STOCK');
  const [search, setSearch] = useState('');
  const [boatFilter, setBoatFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | MovementType>('ALL');

  // Create / Edit Inventory Spec Modal (Admin Only)
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);
  const [boatId, setBoatId] = useState(accessibleBoats[0]?.id || 'boat-sovereign');
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState('cat-prov');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('units');
  const [currentQty, setCurrentQty] = useState(10);
  const [requiredQty, setRequiredQty] = useState(20);
  const [minWarningQty, setMinWarningQty] = useState(12);
  const [maxQty, setMaxQty] = useState<number | undefined>(40);
  const [specError, setSpecError] = useState('');

  // Stock Movement Modal (Admin / Master)
  const [movModalItem, setMovModalItem] = useState<ComputedInventoryItem | null>(null);
  const [movType, setMovType] = useState<MovementType>('ADDED');
  const [movQty, setMovQty] = useState(5);
  const [movReason, setMovReason] = useState('');
  const [movRef, setMovRef] = useState('');
  const [movError, setMovError] = useState('');

  const boatNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    accessibleBoats.forEach((b) => {
      map[b.id] = b.name;
    });
    return map;
  }, [accessibleBoats]);

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleInventory.filter((item) => {
      const matchesQ =
        !q ||
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (boatNameMap[item.boatId] || '').toLowerCase().includes(q);
      const matchesBoat = boatFilter === 'ALL' || item.boatId === boatFilter;
      const matchesCat = categoryFilter === 'ALL' || item.categoryId === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesQ && matchesBoat && matchesCat && matchesStatus;
    });
  }, [
    accessibleInventory,
    search,
    boatFilter,
    categoryFilter,
    statusFilter,
    boatNameMap,
  ]);

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleMovements.filter((m) => {
      const matchesQ =
        !q ||
        m.productName.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        m.performedByName.toLowerCase().includes(q) ||
        m.boatName.toLowerCase().includes(q);
      const matchesBoat = boatFilter === 'ALL' || m.boatId === boatFilter;
      const matchesType =
        movementTypeFilter === 'ALL' || m.movementType === movementTypeFilter;
      return matchesQ && matchesBoat && matchesType;
    });
  }, [accessibleMovements, search, boatFilter, movementTypeFilter]);

  const openCreateSpecModal = () => {
    setEditingItemId(undefined);
    setBoatId(accessibleBoats[0]?.id || 'boat-sovereign');
    setSku(`MAR-SPEC-${Math.floor(100 + Math.random() * 899)}`);
    setProductName('');
    setCategoryId(categories[0]?.id || 'cat-prov');
    setDescription('');
    setUnit('units');
    setCurrentQty(15);
    setRequiredQty(25);
    setMinWarningQty(15);
    setMaxQty(50);
    setSpecError('');
    setSpecModalOpen(true);
  };

  const openEditSpecModal = (item: ComputedInventoryItem) => {
    setEditingItemId(item.id);
    setBoatId(item.boatId);
    setSku(item.sku);
    setProductName(item.productName);
    setCategoryId(item.categoryId);
    setDescription(item.description);
    setUnit(item.unit);
    setCurrentQty(item.currentQty);
    setRequiredQty(item.requiredQty);
    setMinWarningQty(item.minWarningQty);
    setMaxQty(item.maxQty);
    setSpecError('');
    setSpecModalOpen(true);
  };

  const handleSpecSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSpecError('');
    const cat = categories.find((c) => c.id === categoryId) || categories[0];
    const res = createOrUpdateInventoryItem({
      id: editingItemId,
      boatId,
      sku,
      productName,
      categoryId: cat.id,
      categoryName: cat.name,
      description,
      unit,
      currentQty: Number(currentQty),
      requiredQty: Number(requiredQty),
      minWarningQty: Number(minWarningQty),
      maxQty: maxQty ? Number(maxQty) : undefined,
    });
    if (!res.ok) {
      setSpecError(res.error || 'Could not save inventory specification.');
      return;
    }
    setSpecModalOpen(false);
  };

  const handleMovementSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movModalItem) return;
    setMovError('');
    const res = recordStockMovement({
      boatInventoryId: movModalItem.id,
      movementType: movType,
      quantity: Number(movQty),
      reason: movReason,
      referenceCode: movRef,
    });
    if (!res.ok) {
      setMovError(res.error || 'Could not record movement.');
      return;
    }
    setMovModalItem(null);
  };

  const handleExportInventoryCsv = () => {
    exportToCsv(
      'OctoFleet_Inventory_Specifications.csv',
      [
        'Boat',
        'SKU',
        'Product Name',
        'Category',
        'Unit',
        'Current Quantity',
        'Required Quantity',
        'Missing Quantity',
        'Min Warning Quantity',
        'Max Quantity',
        'Status',
        'Last Updated',
      ],
      filteredInventory.map((item) => [
        boatNameMap[item.boatId] || item.boatId,
        item.sku,
        item.productName,
        item.categoryName,
        item.unit,
        item.currentQty,
        item.requiredQty,
        item.missingQty,
        item.minWarningQty,
        item.maxQty ?? '',
        item.status,
        item.lastUpdatedAt,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Tabs & Primary Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'STOCK'
                ? 'bg-[#0B132B] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="h-4 w-4" />
            Boat Inventory & Specifications ({filteredInventory.length})
          </button>
          <button
            onClick={() => setActiveTab('MOVEMENTS')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'MOVEMENTS'
                ? 'bg-[#0B132B] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-4 w-4" />
            Stock Movement Ledger ({filteredMovements.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportInventoryCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
          >
            <Download className="h-4 w-4 text-slate-600" />
            Export CSV
          </button>
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={openCreateSpecModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Add Inventory Item
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, product name, boat, or reason..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by Boat"
            value={boatFilter}
            onChange={(e) => setBoatFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
          >
            <option value="ALL">All Accessible Boats</option>
            {accessibleBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {activeTab === 'STOCK' ? (
            <>
              <select
                aria-label="Filter by Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'ALL' | ComplianceStatus)
                }
                className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="MEETS_SPEC">Meets Specifications</option>
                <option value="ATTENTION">Needs Attention</option>
                <option value="CRITICAL">Critical Shortages</option>
              </select>
            </>
          ) : (
            <select
              aria-label="Filter by Movement Type"
              value={movementTypeFilter}
              onChange={(e) =>
                setMovementTypeFilter(e.target.value as 'ALL' | MovementType)
              }
              className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
            >
              <option value="ALL">All Movement Types</option>
              <option value="ADDED">Stock Added (+)</option>
              <option value="REMOVED">Stock Removed (−)</option>
              <option value="ADJUSTED">Stock Adjusted (±)</option>
              <option value="TRANSFERRED">Stock Transferred (⇄)</option>
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: BOAT INVENTORY & SPECIFICATIONS TABLE */}
      {activeTab === 'STOCK' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Boat</th>
                  <th className="py-3.5 px-4">Product & SKU</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Current Qty</th>
                  <th className="py-3.5 px-4 text-right">Required Qty</th>
                  <th className="py-3.5 px-4 text-right">Missing Qty</th>
                  <th className="py-3.5 px-4 text-right">Min Warn</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Last Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500">
                      No inventory items match your active filters.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/90">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <Link
                          href={`/dashboard/boats/${item.boatId}`}
                          className="hover:text-orange-600"
                        >
                          {boatNameMap[item.boatId] || item.boatId}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.sku} • {item.description}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{item.categoryName}</td>
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
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-500">
                        {item.minWarningQty} {item.unit}
                      </td>
                      <td className="py-3.5 px-4">
                        <ComplianceBadge status={item.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 tabular-nums">
                        <div>{new Date(item.lastUpdatedAt).toLocaleDateString()}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.lastUpdatedBy}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {currentUser.role !== 'OWNER' && (
                            <button
                              onClick={() => {
                                setMovModalItem(item);
                                setMovType('ADDED');
                                setMovQty(5);
                                setMovReason('Standard Onboard Stock Update');
                                setMovRef('');
                                setMovError('');
                              }}
                              className="rounded bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold"
                            >
                              Move Stock
                            </button>
                          )}
                          {currentUser.role === 'ADMIN' && (
                            <button
                              onClick={() => openEditSpecModal(item)}
                              title="Edit Inventory Specification"
                              className="rounded border border-slate-300 bg-white hover:bg-slate-50 p-1 text-slate-700"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {currentUser.role === 'OWNER' && (
                            <button
                              onClick={() =>
                                submitRestockRequest({
                                  boatInventoryId: item.id,
                                  requestedQty:
                                    item.missingQty > 0 ? item.missingQty : 10,
                                  priority:
                                    item.status === 'CRITICAL' ? 'URGENT' : 'HIGH',
                                  reason: `Owner quick restock request for ${item.productName}`,
                                })
                              }
                              className="rounded bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 text-[11px] font-bold"
                            >
                              Request Restock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FULL STOCK MOVEMENT HISTORY TABLE */}
      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Boat</th>
                  <th className="py-3.5 px-4">Product & SKU</th>
                  <th className="py-3.5 px-4">Movement Type</th>
                  <th className="py-3.5 px-4 text-right">Previous Qty</th>
                  <th className="py-3.5 px-4 text-right">Delta</th>
                  <th className="py-3.5 px-4 text-right">New Qty</th>
                  <th className="py-3.5 px-4">Reason & Reference</th>
                  <th className="py-3.5 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(mov.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {mov.boatName}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{mov.productName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {mov.sku}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <MovementTypeBadge type={mov.movementType} />
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-600">
                      {mov.previousQty} {mov.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold">
                      <span
                        className={
                          mov.deltaQty >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }
                      >
                        {mov.deltaQty >= 0 ? `+${mov.deltaQty}` : mov.deltaQty}{' '}
                        {mov.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900">
                      {mov.newQty} {mov.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div>{mov.reason}</div>
                      {mov.referenceCode && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Ref: {mov.referenceCode}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {mov.performedByName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Inventory Specification Modal (Admin Only) */}
      {specModalOpen && currentUser.role === 'ADMIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              {editingItemId
                ? 'Edit Boat Inventory Specification'
                : 'Add New Boat Inventory Item'}
            </h3>
            <form onSubmit={handleSpecSave} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Assigned Boat
                  </label>
                  <select
                    value={boatId}
                    onChange={(e) => setBoatId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    {accessibleBoats.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    SKU / Item Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Current Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={currentQty}
                    onChange={(e) => setCurrentQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
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
                    value={requiredQty}
                    onChange={(e) => setRequiredQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Min Warn Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={minWarningQty}
                    onChange={(e) => setMinWarningQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {specError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                  {specError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSpecModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 text-xs font-bold"
                >
                  Save Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Stock Movement Modal */}
      {movModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              Record Stock Movement — {movModalItem.productName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Current Stock: <strong>{movModalItem.currentQty}</strong> / Required:{' '}
              <strong>{movModalItem.requiredQty}</strong> {movModalItem.unit}
            </p>
            <form onSubmit={handleMovementSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Movement Type
                </label>
                <select
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as MovementType)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  <option value="ADDED">Stock Added (+)</option>
                  <option value="REMOVED">Stock Removed (−)</option>
                  <option value="ADJUSTED">Stock Adjusted (Set New Quantity)</option>
                  <option value="TRANSFERRED">Stock Transferred (⇄)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  {movType === 'ADJUSTED' ? 'New Exact Quantity' : 'Quantity'}
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={movQty}
                  onChange={(e) => setMovQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Reason *
                </label>
                <input
                  type="text"
                  required
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              {movError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                  {movError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovModalItem(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold"
                >
                  Record Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
