'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Filter,
  History,
  Plus,
  Search,
  ShieldAlert,
  Ship,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFleet } from '@/context/FleetContext';
import {
  ComplianceBadge,
  MovementTypeBadge,
  RoleBadge,
} from '@/components/ui/StatusBadge';
import { calculateFleetOrBoatCompliance } from '@/lib/inventory-math';
import { exportToCsv } from '@/lib/csv-export';
import { ComplianceStatus } from '@/types/domain';

export default function DashboardPage() {
  const { currentUser } = useFleet();

  return (
    <div className="space-y-6">
      {/* Role Context Banner */}
      <div className="rounded-xl bg-[#0B132B] text-white p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <RoleBadge role={currentUser.role} />
          <div>
            <p className="text-sm font-bold text-white">
              {currentUser.role === 'ADMIN' &&
                'Administrator Command View — Full Fleet, Inventory & Integration Authority'}
              {currentUser.role === 'MASTER' &&
                'Fleet Master Compliance Desk — Multi-Vessel Readiness & Restock Approval'}
              {currentUser.role === 'OWNER' &&
                'Owner Vessel Portal — Dedicated Inventory Compliance & Restock Requests'}
            </p>
            <p className="text-xs text-slate-400">
              Active User: {currentUser.fullName} ({currentUser.email})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/dashboard/restock"
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 font-semibold transition-colors"
          >
            Restock Queue
          </Link>
          <Link
            href="/dashboard/reports"
            className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 font-bold transition-colors"
          >
            Export Reports
          </Link>
        </div>
      </div>

      {currentUser.role === 'ADMIN' && <AdminDashboardView />}
      {currentUser.role === 'MASTER' && <MasterDashboardView />}
      {currentUser.role === 'OWNER' && <OwnerDashboardView />}
    </div>
  );
}

/* ============================================================================
 * 1. ADMIN DASHBOARD VIEW (Section 6)
 * ========================================================================== */
function AdminDashboardView() {
  const router = useRouter();
  const {
    accessibleBoats,
    accessibleInventory,
    accessibleRestockRequests,
    accessibleMovements,
    auditLogs,
    categories,
  } = useFleet();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'compliance' | 'lowStock'>('compliance');
  const [sortAsc, setSortAsc] = useState(true);

  const totalBoats = accessibleBoats.length;
  const totalItems = accessibleInventory.length;
  const boatsBelowSpec = accessibleBoats.filter((b) => b.overallStatus !== 'MEETS_SPEC').length;
  const pendingRestocks = accessibleRestockRequests.filter((r) => r.status === 'PENDING').length;
  const overallCompliance = calculateFleetOrBoatCompliance(accessibleInventory);

  const filteredBoats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = accessibleBoats.filter((b) => {
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.registrationNumber.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q) ||
        b.homePort.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || b.overallStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      if (sortBy === 'compliance') cmp = a.compliancePercentage - b.compliancePercentage;
      if (sortBy === 'lowStock') cmp = b.lowStockItemsCount - a.lowStockItemsCount;
      return sortAsc ? cmp : -cmp;
    });
  }, [accessibleBoats, search, statusFilter, sortBy, sortAsc]);

  const boatsRequiringAttention = useMemo(() => {
    return accessibleBoats
      .filter((b) => b.overallStatus !== 'MEETS_SPEC')
      .sort((a, b) => a.compliancePercentage - b.compliancePercentage);
  }, [accessibleBoats]);

  const categoryBreakdown = useMemo(() => {
    return categories.map((cat) => {
      const catItems = accessibleInventory.filter((i) => i.categoryId === cat.id);
      const lowCount = catItems.filter((i) => i.status !== 'MEETS_SPEC').length;
      const compliance = calculateFleetOrBoatCompliance(catItems);
      return {
        name: cat.code,
        fullName: cat.name,
        itemCount: catItems.length,
        lowCount,
        compliance,
      };
    });
  }, [categories, accessibleInventory]);

  const toggleSort = (field: 'name' | 'compliance' | 'lowStock') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 5 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Boats
            </span>
            <Ship className="h-4.5 w-4.5 text-slate-700" />
          </div>
          <p className="text-3xl font-bold text-slate-950 mt-2 tabular-nums">{totalBoats}</p>
          <p className="text-xs text-slate-500 mt-1">Active vessels in registry</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Inventory Items
            </span>
            <Boxes className="h-4.5 w-4.5 text-slate-700" />
          </div>
          <p className="text-3xl font-bold text-slate-950 mt-2 tabular-nums">{totalItems}</p>
          <p className="text-xs text-slate-500 mt-1">Tracked across all hulls</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Boats Below Spec
            </span>
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-2 tabular-nums">{boatsBelowSpec}</p>
          <p className="text-xs text-slate-500 mt-1">Require replenishment</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending Restocks
            </span>
            <ClipboardList className="h-4.5 w-4.5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-2 tabular-nums">
            {pendingRestocks}
          </p>
          <p className="text-xs text-slate-500 mt-1">Awaiting Master approval</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fleet Compliance
            </span>
            <TrendingUp className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {overallCompliance}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full"
              style={{ width: `${overallCompliance}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Fleet Inventory Status Table + Boats Requiring Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Fleet Inventory Status Table */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Fleet Inventory Status Table
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any vessel row to inspect its detailed inventory specification
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search boat, IMO, owner..."
                  className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <select
                aria-label="Filter by compliance status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ComplianceStatus)}
                className="text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-medium text-slate-700"
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
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">
                    <button
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Vessel / IMO <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Owner & Master</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      onClick={() => toggleSort('compliance')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Compliance <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      onClick={() => toggleSort('lowStock')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Shortages <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBoats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No vessels match your current search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBoats.map((boat) => (
                    <tr
                      key={boat.id}
                      onClick={() => router.push(`/dashboard/boats/${boat.id}`)}
                      className="hover:bg-orange-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-orange-600 flex items-center gap-1.5">
                          {boat.name}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {boat.registrationNumber} • {boat.homePort}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{boat.ownerName}</div>
                        <div className="text-[11px] text-slate-500">
                          Master: {boat.masterName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums">
                        <span className="font-bold text-slate-900">
                          {boat.compliancePercentage}%
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {boat.totalItems} items tracked
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums">
                        {boat.lowStockItemsCount > 0 ? (
                          <span className="font-bold text-rose-600">
                            {boat.lowStockItemsCount} below spec
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">0 shortages</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <ComplianceBadge status={boat.overallStatus} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 4 Cols: Boats Requiring Attention + Category Breakdown */}
        <div className="lg:col-span-4 space-y-6">
          {/* Boats Requiring Attention */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Boats Requiring Attention
                </h3>
                <p className="text-xs text-slate-500">
                  Vessels currently below required specification
                </p>
              </div>
              <ShieldAlert className="h-5 w-5 text-orange-500" />
            </div>

            {boatsRequiringAttention.length === 0 ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 font-medium">
                All vessels currently meet 100% of inventory specifications.
              </div>
            ) : (
              <div className="space-y-3">
                {boatsRequiringAttention.map((boat) => (
                  <Link
                    key={boat.id}
                    href={`/dashboard/boats/${boat.id}`}
                    className="block rounded-lg border border-slate-200 p-3.5 hover:border-orange-500 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {boat.name}
                      </span>
                      <ComplianceBadge status={boat.overallStatus} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {boat.lowStockItemsCount} item(s) below spec ({boat.criticalItemsCount}{' '}
                        critical)
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">
                        {boat.compliancePercentage}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Category Breakdown Chart */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-950">
              Inventory Category Compliance
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Specification fulfillment % across maritime categories
            </p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    formatter={(value: number) => [`${value}% Compliance`, 'Compliance']}
                  />
                  <Bar dataKey="compliance" radius={[4, 4, 0, 0]}>
                    {categoryBreakdown.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          entry.compliance === 100
                            ? '#10b981'
                            : entry.compliance >= 75
                            ? '#f97316'
                            : '#e11d48'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {categoryBreakdown.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-xs text-slate-600"
                >
                  <span className="truncate">
                    <strong className="text-slate-800">{c.name}</strong> — {c.fullName}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {c.compliance}% ({c.itemCount} items)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Stock Movements & Recent System Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Stock Movements */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950">
                Recent Stock Movements
              </h3>
              <p className="text-xs text-slate-500">
                Latest additions, consumptions, adjustments & transfers
              </p>
            </div>
            <Link
              href="/dashboard/inventory"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              Full Ledger →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {accessibleMovements.slice(0, 5).map((mov) => (
              <div
                key={mov.id}
                className="py-3 flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MovementTypeBadge type={mov.movementType} />
                    <span className="font-bold text-slate-900">{mov.productName}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-700">{mov.boatName}</span>
                  </div>
                  <p className="text-slate-500 mt-1 truncate">{mov.reason}</p>
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
            ))}
          </div>
        </div>

        {/* Recent System Activity (Audit Logs) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950">
                Recent System Activity
              </h3>
              <p className="text-xs text-slate-500">
                Immutable administrative & operational audit trail
              </p>
            </div>
            <History className="h-4.5 w-4.5 text-slate-400" />
          </div>

          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RoleBadge role={log.actorRole} />
                    <span className="font-bold text-slate-900">{log.actorName}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">{log.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. MASTER DASHBOARD VIEW (Section 7 — Fleet Visibility & Compliance)
 * ========================================================================== */
function MasterDashboardView() {
  const router = useRouter();
  const {
    accessibleBoats,
    accessibleInventory,
    accessibleRestockRequests,
    categories,
  } = useFleet();

  const [selectedBoatFilter, setSelectedBoatFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    'ALL' | ComplianceStatus
  >('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const totalBoats = accessibleBoats.length;
  const boatsMeetingSpec = accessibleBoats.filter(
    (b) => b.overallStatus === 'MEETS_SPEC'
  ).length;
  const boatsBelowSpec = accessibleBoats.filter(
    (b) => b.overallStatus !== 'MEETS_SPEC'
  ).length;
  const criticalWarningsCount = accessibleInventory.filter(
    (i) => i.status === 'CRITICAL'
  ).length;
  const pendingRestocks = accessibleRestockRequests.filter(
    (r) => r.status === 'PENDING'
  ).length;

  const filteredMasterBoats = useMemo(() => {
    return accessibleBoats.filter((boat) => {
      if (selectedBoatFilter !== 'ALL' && boat.id !== selectedBoatFilter) {
        return false;
      }
      if (
        selectedStatusFilter !== 'ALL' &&
        boat.overallStatus !== selectedStatusFilter
      ) {
        return false;
      }
      if (selectedCategoryFilter !== 'ALL') {
        const boatCatItems = accessibleInventory.filter(
          (i) => i.boatId === boat.id && i.categoryId === selectedCategoryFilter
        );
        if (boatCatItems.length === 0) return false;
      }
      return true;
    });
  }, [
    accessibleBoats,
    accessibleInventory,
    selectedBoatFilter,
    selectedStatusFilter,
    selectedCategoryFilter,
  ]);

  return (
    <div className="space-y-6">
      {/* Master Top 5 Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Assigned Fleet Boats
          </span>
          <p className="text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {totalBoats}
          </p>
          <p className="text-xs text-slate-500 mt-1">Under your Master command</p>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Meets Specifications
          </span>
          <p className="text-3xl font-bold text-emerald-600 mt-2 tabular-nums">
            {boatsMeetingSpec}
          </p>
          <p className="text-xs text-slate-500 mt-1">100% compliant vessels</p>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Boats Below Spec
          </span>
          <p className="text-3xl font-bold text-amber-600 mt-2 tabular-nums">
            {boatsBelowSpec}
          </p>
          <p className="text-xs text-slate-500 mt-1">Require restock action</p>
        </div>

        <div className="bg-white rounded-xl border border-rose-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
            Critical Warnings
          </span>
          <p className="text-3xl font-bold text-rose-600 mt-2 tabular-nums">
            {criticalWarningsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Severe or zero-stock items</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pending Restock Requests
          </span>
          <p className="text-3xl font-bold text-orange-600 mt-2 tabular-nums">
            {pendingRestocks}
          </p>
          <Link
            href="/dashboard/restock"
            className="text-xs font-semibold text-orange-600 hover:underline mt-1 inline-block"
          >
            Review requests →
          </Link>
        </div>
      </div>

      {/* Fleet Compliance Table with Filters (Boat, Status, Category) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              Fleet Compliance & Readiness Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare inventory compliance across assigned boats. Click a vessel to open its detailed inventory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Filter className="h-3.5 w-3.5 text-orange-500" />
              Filters:
            </div>
            <select
              aria-label="Filter by Boat"
              value={selectedBoatFilter}
              onChange={(e) => setSelectedBoatFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white font-medium"
            >
              <option value="ALL">All Assigned Boats</option>
              {accessibleBoats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Overall Status"
              value={selectedStatusFilter}
              onChange={(e) =>
                setSelectedStatusFilter(e.target.value as 'ALL' | ComplianceStatus)
              }
              className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="MEETS_SPEC">Green: Meets Specifications</option>
              <option value="ATTENTION">Amber: Needs Attention</option>
              <option value="CRITICAL">Red: Critical Shortages</option>
            </select>

            <select
              aria-label="Filter by Inventory Category"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white font-medium"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Boat Name</th>
                <th className="py-3.5 px-4">Assigned Owner</th>
                <th className="py-3.5 px-4 text-right">Total Items</th>
                <th className="py-3.5 px-4 text-right">Compliance %</th>
                <th className="py-3.5 px-4 text-right">Low-Stock Items</th>
                <th className="py-3.5 px-4">Last Inventory Update</th>
                <th className="py-3.5 px-4">Overall Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMasterBoats.map((boat) => (
                <tr
                  key={boat.id}
                  onClick={() => router.push(`/dashboard/boats/${boat.id}`)}
                  className="hover:bg-orange-50/40 cursor-pointer transition-colors group"
                >
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-900 group-hover:text-orange-600">
                      {boat.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {boat.registrationNumber}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800">
                    {boat.ownerName}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold tabular-nums">
                    {boat.totalItems}
                  </td>
                  <td className="py-4 px-4 text-right tabular-nums">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            boat.overallStatus === 'MEETS_SPEC'
                              ? 'bg-emerald-500'
                              : boat.overallStatus === 'ATTENTION'
                              ? 'bg-amber-500'
                              : 'bg-rose-600'
                          }`}
                          style={{ width: `${boat.compliancePercentage}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900">
                        {boat.compliancePercentage}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right tabular-nums">
                    {boat.lowStockItemsCount > 0 ? (
                      <span className="font-bold text-rose-600">
                        {boat.lowStockItemsCount} item(s)
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-500 tabular-nums">
                    {new Date(boat.lastInventoryUpdate).toLocaleString()}
                  </td>
                  <td className="py-4 px-4">
                    <ComplianceBadge status={boat.overallStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. OWNER DASHBOARD VIEW (Section 8 — Dedicated Boat Portal & Prominent Warnings)
 * ========================================================================== */
function OwnerDashboardView() {
  const {
    accessibleBoats,
    getBoatInventory,
    accessibleRestockRequests,
    submitRestockRequest,
  } = useFleet();

  const [selectedBoatId, setSelectedBoatId] = useState<string>(
    accessibleBoats[0]?.id || ''
  );
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [requestedQty, setRequestedQty] = useState<number>(10);
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('HIGH');
  const [reason, setReason] = useState<string>('');

  const activeBoat =
    accessibleBoats.find((b) => b.id === selectedBoatId) || accessibleBoats[0];

  const boatInventory = useMemo(() => {
    if (!activeBoat) return [];
    return getBoatInventory(activeBoat.id);
  }, [activeBoat, getBoatInventory]);

  const boatPendingRestocks = useMemo(() => {
    if (!activeBoat) return 0;
    return accessibleRestockRequests.filter(
      (r) => r.boatId === activeBoat.id && r.status === 'PENDING'
    ).length;
  }, [activeBoat, accessibleRestockRequests]);

  const openRestockModalForItem = (itemId?: string) => {
    const targetItem =
      boatInventory.find((i) => i.id === itemId) ||
      boatInventory.find((i) => i.missingQty > 0) ||
      boatInventory[0];
    if (targetItem) {
      setSelectedInventoryId(targetItem.id);
      setRequestedQty(targetItem.missingQty > 0 ? targetItem.missingQty : 5);
      setPriority(targetItem.status === 'CRITICAL' ? 'URGENT' : 'HIGH');
      setReason(
        `Replenish ${targetItem.productName} to required vessel specification (${targetItem.requiredQty} ${targetItem.unit}).`
      );
    }
    setRestockModalOpen(true);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = submitRestockRequest({
      boatInventoryId: selectedInventoryId,
      requestedQty: Number(requestedQty),
      priority,
      reason,
    });
    if (res.ok) {
      setRestockModalOpen(false);
    }
  };

  const handleDownloadOwnerReport = () => {
    if (!activeBoat) return;
    exportToCsv(
      `${activeBoat.name.replace(/\s+/g, '_')}_Inventory_Report.csv`,
      [
        'Vessel',
        'SKU',
        'Product Name',
        'Category',
        'Current Quantity',
        'Required Quantity',
        'Missing Quantity',
        'Unit',
        'Status',
        'Last Updated',
      ],
      boatInventory.map((item) => [
        activeBoat.name,
        item.sku,
        item.productName,
        item.categoryName,
        item.currentQty,
        item.requiredQty,
        item.missingQty,
        item.unit,
        item.status === 'MEETS_SPEC'
          ? 'Meets requirements'
          : `${item.missingQty} missing`,
        item.lastUpdatedAt,
      ])
    );
  };

  if (!activeBoat) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-sm font-bold text-slate-800">
          No vessels are currently assigned to your Owner profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vessel Selector (if Owner has multiple assigned vessels) & Primary Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-950">{activeBoat.name}</h2>
            <ComplianceBadge status={activeBoat.overallStatus} />
            <span className="text-xs font-mono text-slate-500">
              {activeBoat.registrationNumber} • {activeBoat.homePort}
            </span>
          </div>
          <p className="text-xs text-slate-500">{activeBoat.description}</p>

          {accessibleBoats.length > 1 && (
            <div className="pt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Switch Your Assigned Vessel:
              </span>
              {accessibleBoats.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBoatId(b.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    b.id === activeBoat.id
                      ? 'bg-[#0B132B] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {b.name} ({b.compliancePercentage}%)
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadOwnerReport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-600" />
            Download Boat Inventory Report (CSV)
          </button>
          <button
            onClick={() => openRestockModalForItem()}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Submit Restock Request
          </button>
        </div>
      </div>

      {/* Owner Top 5 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Vessel Name
          </span>
          <p className="text-xl font-bold text-slate-950 mt-2 truncate">
            {activeBoat.name}
          </p>
          <p className="text-xs text-slate-500 mt-1">{activeBoat.vesselClass}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Overall Compliance
          </span>
          <p className="text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {activeBoat.compliancePercentage}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{activeBoat.specificationTier}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Inventory Items
          </span>
          <p className="text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {activeBoat.totalItems}
          </p>
          <p className="text-xs text-slate-500 mt-1">Specification lines</p>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Items Below Spec
          </span>
          <p className="text-3xl font-bold text-rose-600 mt-2 tabular-nums">
            {activeBoat.lowStockItemsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Missing required stock</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pending Restock Requests
          </span>
          <p className="text-3xl font-bold text-orange-600 mt-2 tabular-nums">
            {boatPendingRestocks}
          </p>
          <p className="text-xs text-slate-500 mt-1">In Master review queue</p>
        </div>
      </div>

      {/* Prominent Specification Warnings Banner (Exact Format Requested in Section 8) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-orange-500" />
            Stock Specification & Missing Quantity Highlights
          </h3>
          <span className="text-xs text-slate-500">
            Formula: Missing = MAX(Required − Current, 0)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {boatInventory.slice(0, 6).map((item) => {
            const isMissing = item.missingQty > 0;
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3.5 flex items-center justify-between gap-3 ${
                  isMissing
                    ? 'border-amber-300 bg-amber-50/60'
                    : 'border-emerald-200 bg-emerald-50/40'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    {item.productName}:{' '}
                    <span className="tabular-nums">
                      {item.currentQty} / {item.requiredQty} {item.unit}
                    </span>
                  </p>
                  <p
                    className={`text-xs font-semibold mt-0.5 ${
                      isMissing ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {isMissing
                      ? `(${item.missingQty} missing)`
                      : '(Meets requirements)'}
                  </p>
                </div>
                {isMissing ? (
                  <button
                    onClick={() => openRestockModalForItem(item.id)}
                    className="shrink-0 rounded bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 text-[11px] font-bold"
                  >
                    Restock
                  </button>
                ) : (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Owner Complete Boat Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              {activeBoat.name} — Complete Inventory & Specification Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time onboard quantities compared against required vessel specifications
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Current Quantity</th>
                <th className="py-3.5 px-4 text-right">Required Quantity</th>
                <th className="py-3.5 px-4 text-right">Missing Quantity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {boatInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{item.sku}</div>
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
                        {item.missingQty} {item.unit} missing
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <ComplianceBadge
                      status={item.status}
                      labelOverride={
                        item.status === 'MEETS_SPEC'
                          ? 'Meets requirements'
                          : `${item.missingQty} missing`
                      }
                    />
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 tabular-nums">
                    {new Date(item.lastUpdatedAt).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => openRestockModalForItem(item.id)}
                      className="rounded-lg border border-slate-300 bg-white hover:border-orange-500 hover:text-orange-600 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors"
                    >
                      Request Restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Restock Request Modal */}
      {restockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              Submit Restock Request — {activeBoat.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Your request will be routed to Fleet Master {activeBoat.masterName} for approval.
            </p>

            <form onSubmit={handleRestockSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Product
                </label>
                <select
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {boatInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productName} ({item.currentQty}/{item.requiredQty} {item.unit} —{' '}
                      {item.missingQty} missing)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Requested Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={requestedQty}
                    onChange={(e) => setRequestedQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'NORMAL' | 'HIGH' | 'URGENT')
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent (Pre-Departure)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Operational Reason /Voyage Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
                >
                  Submit Restock Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
