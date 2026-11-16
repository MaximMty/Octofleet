'use client';

import React, { useMemo, useState } from 'react';
import {
  Download,
  FileBarChart2,
  Filter,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import {
  ComplianceBadge,
  MovementTypeBadge,
  RestockStatusBadge,
} from '@/components/ui/StatusBadge';
import { ComplianceBarChart } from '@/components/ui/ComplianceBarChart';
import { exportToCsv } from '@/lib/csv-export';
import { calculateFleetOrBoatCompliance } from '@/lib/inventory-math';
import { formatDateTime } from '@/lib/format';

type ReportType =
  | 'COMPLIANCE_BY_BOAT'
  | 'BELOW_SPEC'
  | 'STOCK_MOVEMENTS'
  | 'RESTOCK_REQUESTS'
  | 'CATEGORY_BREAKDOWN';

export default function ReportsAndAnalyticsPage() {
  const {
    accessibleBoats,
    accessibleInventory,
    accessibleMovements,
    accessibleRestockRequests,
    categories,
  } = useFleet();

  const [reportType, setReportType] = useState<ReportType>('COMPLIANCE_BY_BOAT');
  const [boatFilter, setBoatFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');

  const boatNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    accessibleBoats.forEach((b) => {
      map[b.id] = b.name;
    });
    return map;
  }, [accessibleBoats]);

  const filteredBoats = useMemo(() => {
    return accessibleBoats.filter((b) => boatFilter === 'ALL' || b.id === boatFilter);
  }, [accessibleBoats, boatFilter]);

  const filteredInventory = useMemo(() => {
    return accessibleInventory.filter((i) => {
      const matchesBoat = boatFilter === 'ALL' || i.boatId === boatFilter;
      const matchesCat = categoryFilter === 'ALL' || i.categoryId === categoryFilter;
      const day = i.lastUpdatedAt.slice(0, 10);
      const matchesDate = day >= dateFrom && day <= dateTo;
      return matchesBoat && matchesCat && matchesDate;
    });
  }, [accessibleInventory, boatFilter, categoryFilter, dateFrom, dateTo]);

  const itemsBelowSpec = useMemo(() => {
    return filteredInventory.filter((i) => i.missingQty > 0);
  }, [filteredInventory]);

  const filteredMovements = useMemo(() => {
    return accessibleMovements.filter((m) => {
      const matchesBoat = boatFilter === 'ALL' || m.boatId === boatFilter;
      const day = m.createdAt.slice(0, 10);
      const matchesDate = day >= dateFrom && day <= dateTo;
      return matchesBoat && matchesDate;
    });
  }, [accessibleMovements, boatFilter, dateFrom, dateTo]);

  const filteredRestocks = useMemo(() => {
    return accessibleRestockRequests.filter((r) => {
      const matchesBoat = boatFilter === 'ALL' || r.boatId === boatFilter;
      const day = r.createdAt.slice(0, 10);
      const matchesDate = day >= dateFrom && day <= dateTo;
      return matchesBoat && matchesDate;
    });
  }, [accessibleRestockRequests, boatFilter, dateFrom, dateTo]);

  const categoryBreakdown = useMemo(() => {
    return categories.map((cat) => {
      const items = filteredInventory.filter((i) => i.categoryId === cat.id);
      const totalCurrent = items.reduce((acc, i) => acc + i.currentQty, 0);
      const totalRequired = items.reduce((acc, i) => acc + i.requiredQty, 0);
      const totalMissing = items.reduce((acc, i) => acc + i.missingQty, 0);
      const compliance = calculateFleetOrBoatCompliance(items);
      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        itemCount: items.length,
        totalCurrent,
        totalRequired,
        totalMissing,
        compliance,
      };
    });
  }, [categories, filteredInventory]);

  const handleExportCurrentReportCsv = () => {
    if (reportType === 'COMPLIANCE_BY_BOAT') {
      exportToCsv(
        'OctoFleet_Compliance_By_Boat.csv',
        [
          'Boat Name',
          'IMO Number',
          'Owner',
          'Master',
          'Total Items',
          'Items Below Spec',
          'Critical Shortages',
          'Compliance %',
          'Status',
        ],
        filteredBoats.map((b) => [
          b.name,
          b.registrationNumber,
          b.ownerName,
          b.masterName,
          b.totalItems,
          b.lowStockItemsCount,
          b.criticalItemsCount,
          `${b.compliancePercentage}%`,
          b.overallStatus,
        ])
      );
    } else if (reportType === 'BELOW_SPEC') {
      exportToCsv(
        'OctoFleet_Products_Below_Specification.csv',
        [
          'Boat',
          'SKU',
          'Product Name',
          'Category',
          'Current Qty',
          'Required Qty',
          'Missing Qty',
          'Unit',
          'Status',
        ],
        itemsBelowSpec.map((i) => [
          boatNameMap[i.boatId] || i.boatId,
          i.sku,
          i.productName,
          i.categoryName,
          i.currentQty,
          i.requiredQty,
          i.missingQty,
          i.unit,
          i.status,
        ])
      );
    } else if (reportType === 'STOCK_MOVEMENTS') {
      exportToCsv(
        'OctoFleet_Stock_Movement_History.csv',
        [
          'Timestamp',
          'Boat',
          'SKU',
          'Product',
          'Movement Type',
          'Previous Qty',
          'Delta',
          'New Qty',
          'Reason',
          'Recorded By',
        ],
        filteredMovements.map((m) => [
          m.createdAt,
          m.boatName,
          m.sku,
          m.productName,
          m.movementType,
          m.previousQty,
          m.deltaQty,
          m.newQty,
          m.reason,
          m.performedByName,
        ])
      );
    } else if (reportType === 'RESTOCK_REQUESTS') {
      exportToCsv(
        'OctoFleet_Restock_Requests.csv',
        [
          'Request Code',
          'Created At',
          'Boat',
          'Product',
          'Requested Qty',
          'Priority',
          'Status',
          'Requested By',
          'Reviewer',
        ],
        filteredRestocks.map((r) => [
          r.requestCode,
          r.createdAt,
          r.boatName,
          r.productName,
          r.requestedQty,
          r.priority,
          r.status,
          r.requestedByName,
          r.reviewerName || '',
        ])
      );
    } else {
      exportToCsv(
        'OctoFleet_Category_Breakdown.csv',
        [
          'Code',
          'Category Name',
          'Tracked Items',
          'Total Current Units',
          'Total Required Units',
          'Total Missing Units',
          'Compliance %',
        ],
        categoryBreakdown.map((c) => [
          c.code,
          c.name,
          c.itemCount,
          c.totalCurrent,
          c.totalRequired,
          c.totalMissing,
          `${c.compliance}%`,
        ])
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Report Type Selector */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5 text-orange-500" />
            Maritime Fleet Reports & Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate compliance audits, shortage manifests, movement ledgers, and CSV exports scoped to your clearance.
          </p>
        </div>

        <button
          onClick={handleExportCurrentReportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm self-start"
        >
          <Download className="h-4 w-4" />
          Export Active Report (CSV)
        </button>
      </div>

      {/* Report Tabs + Filter Bar */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {(
            [
              ['COMPLIANCE_BY_BOAT', '1. Compliance by Boat'],
              ['BELOW_SPEC', '2. Products Below Spec'],
              ['STOCK_MOVEMENTS', '3. Stock Movement History'],
              ['RESTOCK_REQUESTS', '4. Restock Requests'],
              ['CATEGORY_BREAKDOWN', '5. Category Breakdown'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setReportType(key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                reportType === key
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Filter className="h-3.5 w-3.5 text-orange-400" />
            Report Filters:
          </span>

          <select
            aria-label="Filter Report by Boat"
            value={boatFilter}
            onChange={(e) => setBoatFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 bg-[#0A1122] text-slate-200 font-medium"
          >
            <option value="ALL">All Accessible Boats</option>
            {accessibleBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Report by Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 bg-[#0A1122] text-slate-200 font-medium"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs"
            />
            <span>To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white mb-1">
            Vessel Inventory Compliance Comparison (%)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Percentage of required stock specifications fulfilled per vessel
          </p>
          <ComplianceBarChart
            data={filteredBoats.map((b) => ({
              label: b.name.replace('M/Y ', '').replace('S/Y ', ''),
              subLabel: b.name,
              value: b.compliancePercentage,
              color:
                b.overallStatus === 'MEETS_SPEC'
                  ? 'emerald'
                  : b.overallStatus === 'ATTENTION'
                  ? 'amber'
                  : 'rose',
            }))}
          />
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white mb-1">
            Category Specification Compliance Breakdown (%)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Fulfillment across Provisioning, Engine, Safety, Deck, and Housekeeping
          </p>
          <ComplianceBarChart
            data={categoryBreakdown.map((c) => ({
              label: c.code,
              subLabel: c.name,
              value: c.compliance,
              color: 'orange',
            }))}
          />
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {reportType === 'COMPLIANCE_BY_BOAT' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0A1122] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Boat Name</th>
                  <th className="py-3.5 px-4">IMO Number</th>
                  <th className="py-3.5 px-4">Owner / Master</th>
                  <th className="py-3.5 px-4 text-right">Total Items</th>
                  <th className="py-3.5 px-4 text-right">Low-Stock Items</th>
                  <th className="py-3.5 px-4 text-right">Compliance %</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredBoats.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/60">
                    <td className="py-3.5 px-4 font-bold text-white">{b.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {b.registrationNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {b.ownerName} / {b.masterName}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">{b.totalItems}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-rose-400">
                      {b.lowStockItemsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-white">
                      {b.compliancePercentage}%
                    </td>
                    <td className="py-3.5 px-4">
                      <ComplianceBadge status={b.overallStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'BELOW_SPEC' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0A1122] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Boat</th>
                  <th className="py-3.5 px-4">SKU & Product</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Current Qty</th>
                  <th className="py-3.5 px-4 text-right">Required Qty</th>
                  <th className="py-3.5 px-4 text-right">Missing Qty</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {itemsBelowSpec.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/60">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {boatNameMap[item.boatId] || item.boatId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{item.productName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.sku}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{item.categoryName}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-white">
                      {item.currentQty} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-300">
                      {item.requiredQty} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-rose-400">
                      {item.missingQty} {item.unit} missing
                    </td>
                    <td className="py-3.5 px-4">
                      <ComplianceBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'STOCK_MOVEMENTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0A1122] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Boat</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4 text-right">Previous → New</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/60">
                    <td className="py-3.5 px-4 text-slate-400 tabular-nums">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">{m.boatName}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{m.productName}</td>
                    <td className="py-3.5 px-4">
                      <MovementTypeBadge type={m.movementType} />
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-white">
                      {m.previousQty} → {m.newQty} {m.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{m.reason}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-200">{m.performedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'RESTOCK_REQUESTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0A1122] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Request Code</th>
                  <th className="py-3.5 px-4">Boat</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4 text-right">Requested Qty</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Requester / Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredRestocks.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{r.requestCode}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{r.boatName}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{r.productName}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-orange-400">
                      +{r.requestedQty} {r.unit}
                    </td>
                    <td className="py-3.5 px-4">
                      <RestockStatusBadge status={r.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {r.requestedByName}
                      {r.reviewerName ? ` → Reviewed by ${r.reviewerName}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'CATEGORY_BREAKDOWN' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0A1122] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Category Name</th>
                  <th className="py-3.5 px-4 text-right">Tracked Items</th>
                  <th className="py-3.5 px-4 text-right">Total Onboard Units</th>
                  <th className="py-3.5 px-4 text-right">Total Required Units</th>
                  <th className="py-3.5 px-4 text-right">Total Missing Units</th>
                  <th className="py-3.5 px-4 text-right">Category Compliance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {categoryBreakdown.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-orange-400">{c.code}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{c.name}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums">{c.itemCount}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-white">
                      {c.totalCurrent}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-300">
                      {c.totalRequired}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-rose-400">
                      {c.totalMissing}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-white">
                      {c.compliance}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
