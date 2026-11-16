'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Columns,
  FileSpreadsheet,
  History,
  Info,
  Lock,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { SyncStatusBadge } from '@/components/ui/StatusBadge';
import { ColumnMapping, SheetRowPreview } from '@/types/domain';

export default function GoogleSheetsIntegrationsPage() {
  const {
    currentUser,
    accessibleBoats,
    accessibleInventory,
    integrations,
    syncLogs,
    saveSheetIntegration,
    executeSheetSync,
    addToast,
  } = useFleet();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>(
    integrations[0]?.id || 'int-sovereign'
  );
  const [previewRows, setPreviewRows] = useState<SheetRowPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [includeInvalidSample, setIncludeInvalidSample] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string>(
    'DEMO MODE: Google Service Account credentials are not configured in .env.local. Using realistic simulated worksheet rows — no live external Google Spreadsheet is being modified.'
  );
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, 'USE_SHEET' | 'USE_APP'>
  >({});

  // Config Form State
  const activeIntegration = useMemo(() => {
    return (
      integrations.find((i) => i.id === selectedIntegrationId) || integrations[0]
    );
  }, [integrations, selectedIntegrationId]);

  const [spreadsheetId, setSpreadsheetId] = useState(
    activeIntegration?.spreadsheetId || ''
  );
  const [spreadsheetName, setSpreadsheetName] = useState(
    activeIntegration?.spreadsheetName || ''
  );
  const [worksheetName, setWorksheetName] = useState(
    activeIntegration?.worksheetName || 'Inventory'
  );
  const [syncDirection, setSyncDirection] = useState<
    'BIDIRECTIONAL' | 'IMPORT_ONLY' | 'EXPORT_ONLY'
  >(activeIntegration?.syncDirection || 'BIDIRECTIONAL');
  const [mapping, setMapping] = useState<ColumnMapping>(
    activeIntegration?.columnMapping || {
      sku: 'A',
      productName: 'B',
      category: 'C',
      currentQty: 'D',
      requiredQty: 'E',
      unit: 'F',
      lastUpdated: 'G',
    }
  );

  // New connection modal
  const [newConnModalOpen, setNewConnModalOpen] = useState(false);
  const [newBoatId, setNewBoatId] = useState(accessibleBoats[0]?.id || 'boat-solaris');
  const [newSheetId, setNewSheetId] = useState('1Solaris_Palma_RigAndStore_41C');
  const [newSheetTitle, setNewSheetTitle] = useState(
    'S/Y Solaris — Master Inventory Ledger 2026'
  );
  const [newWorksheet, setNewWorksheet] = useState('Inventory_2026');

  useEffect(() => {
    if (!activeIntegration) return;
    setSpreadsheetId(activeIntegration.spreadsheetId);
    setSpreadsheetName(activeIntegration.spreadsheetName);
    setWorksheetName(activeIntegration.worksheetName);
    setSyncDirection(activeIntegration.syncDirection);
    setMapping(activeIntegration.columnMapping);
  }, [activeIntegration]);

  // Fetch server-side preview & validation
  const fetchServerPreview = async () => {
    if (!activeIntegration) return;
    setPreviewLoading(true);
    try {
      const boatInv = accessibleInventory.filter(
        (i) => i.boatId === activeIntegration.boatId
      );
      const res = await fetch('/api/integrations/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorRole: currentUser.role,
          boatId: activeIntegration.boatId,
          spreadsheetId,
          worksheetName,
          columnMapping: mapping,
          boatInventory: boatInv,
          includeInvalidSample,
          mode: 'PREVIEW',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPreviewRows(data.rows || []);
        if (data.demoBannerMessage) {
          setDemoNotice(data.demoBannerMessage);
        }
      } else {
        addToast({
          type: 'error',
          title: 'Preview Validation Error',
          description: data.error || 'Could not validate worksheet preview.',
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Preview Request Failed',
        description: 'Could not reach server-side synchronization endpoint.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'ADMIN' && activeIntegration) {
      fetchServerPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntegration?.id, includeInvalidSample, currentUser.role]);

  // Admin-Only Guard
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-rose-200 p-8 text-center">
        <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-950">
          Administrator Clearance Required
        </h2>
        <p className="text-xs text-slate-600 mt-2">
          Only users with <strong>ADMIN</strong> clearance may configure Google Sheets integrations, column mappings, or trigger external synchronization.
        </p>
      </div>
    );
  }

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntegration) return;
    saveSheetIntegration({
      id: activeIntegration.id,
      boatId: activeIntegration.boatId,
      spreadsheetId,
      spreadsheetName,
      worksheetName,
      columnMapping: mapping,
      syncDirection,
    });
    fetchServerPreview();
  };

  const handleManualSyncNow = (
    direction: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL'
  ) => {
    if (!activeIntegration) return;
    const hasInvalid = previewRows.some((r) => r.validationStatus === 'INVALID');
    if (hasInvalid) {
      addToast({
        type: 'error',
        title: 'Synchronization Blocked by Validation Error',
        description:
          'One or more worksheet rows contain invalid non-numeric quantities. Fix or exclude invalid rows before confirming sync.',
      });
      return;
    }

    executeSheetSync({
      integrationId: activeIntegration.id,
      direction,
      conflictResolution: conflictChoices,
    });
    setTimeout(() => {
      fetchServerPreview();
    }, 100);
  };

  const handleConnectNewBoatSheet = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveSheetIntegration({
      boatId: newBoatId,
      spreadsheetId: newSheetId,
      spreadsheetName: newSheetTitle,
      worksheetName: newWorksheet,
      columnMapping: mapping,
      syncDirection: 'BIDIRECTIONAL',
    });
    if (res.ok) {
      setNewConnModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Transparent Demo Mode / Server API Banner */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px]">
              Server-Side Google Sheets Integration Engine
            </span>
            <span className="font-bold">Demo Mode Active</span>
          </div>
          <p className="mt-1 leading-relaxed">{demoNotice}</p>
        </div>
      </div>

      {/* Top Bar: Connected Boats Selector & Connect New Spreadsheet Button */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Connected Vessel Spreadsheets ({integrations.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Each boat can connect to its own dedicated Google Spreadsheet and worksheet tab with bidirectional conflict detection.
          </p>
        </div>

        <button
          onClick={() => setNewConnModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white self-start"
        >
          <Plus className="h-4 w-4" />
          Connect Boat Spreadsheet
        </button>
      </div>

      {/* Connected Vessel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {integrations.map((intg) => {
          const isSelected = intg.id === activeIntegration?.id;
          return (
            <div
              key={intg.id}
              onClick={() => setSelectedIntegrationId(intg.id)}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-orange-500 bg-white ring-2 ring-orange-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      {intg.boatName}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      Tab: {intg.worksheetName}
                    </span>
                  </div>
                </div>
                <SyncStatusBadge status={intg.status} />
              </div>

              <p className="text-xs text-slate-600 mt-3 truncate font-medium">
                {intg.spreadsheetName}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Last Sync:{' '}
                {intg.lastSyncedAt
                  ? new Date(intg.lastSyncedAt).toLocaleString()
                  : 'Never'}
              </p>
              {intg.lastSyncSummary && (
                <p className="text-[11px] text-slate-600 mt-1.5 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                  {intg.lastSyncSummary}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Integration Configuration + Column Mapping + Live Preview & Conflict Resolution */}
      {activeIntegration && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Cols: Spreadsheet Config & Column Mapping */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                  <Columns className="h-4 w-4 text-orange-500" />
                  Spreadsheet & Column Mapping — {activeIntegration.boatName}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure Spreadsheet ID, Worksheet & Column Letters
                </p>
              </div>
              {activeIntegration.isDemoMode && (
                <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Demo Data
                </span>
              )}
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  required
                  value={spreadsheetName}
                  onChange={(e) => setSpreadsheetName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    required
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Worksheet Name
                  </label>
                  <input
                    type="text"
                    required
                    value={worksheetName}
                    onChange={(e) => setWorksheetName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Synchronization Mode
                </label>
                <select
                  value={syncDirection}
                  onChange={(e) =>
                    setSyncDirection(
                      e.target.value as
                        | 'BIDIRECTIONAL'
                        | 'IMPORT_ONLY'
                        | 'EXPORT_ONLY'
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  <option value="BIDIRECTIONAL">
                    Bidirectional (Import Sheet Changes & Push App Updates)
                  </option>
                  <option value="IMPORT_ONLY">
                    Import Only (Google Sheets → OctoFleet)
                  </option>
                  <option value="EXPORT_ONLY">
                    Export Only (OctoFleet → Google Sheets)
                  </option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-2.5">
                  Column Letter Mapping (A–Z)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      ['sku', 'SKU / Item Code'],
                      ['productName', 'Product Name'],
                      ['category', 'Category'],
                      ['currentQty', 'Current Qty'],
                      ['requiredQty', 'Required Qty'],
                      ['unit', 'Unit'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-bold uppercase text-slate-500">
                        {label}
                      </label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Col</span>
                        <input
                          type="text"
                          maxLength={2}
                          value={mapping[field]}
                          onChange={(e) =>
                            setMapping({
                              ...mapping,
                              [field]: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-center"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={fetchServerPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Preview
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold"
                >
                  Save Mapping Configuration
                </button>
              </div>
            </form>
          </div>

          {/* Right 7 Cols: Pre-Import Preview, Validation & Conflict Resolution */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Worksheet Data Preview, Validation & Conflict Resolution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inspect incoming spreadsheet values and resolve conflicts before confirming synchronization.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-lg">
                    <input
                      type="checkbox"
                      checked={includeInvalidSample}
                      onChange={(e) => setIncludeInvalidSample(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Simulate Invalid Cell Error
                  </label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">SKU & Product</th>
                      <th className="py-2.5 px-3 text-right">Baseline</th>
                      <th className="py-2.5 px-3 text-right">App Qty</th>
                      <th className="py-2.5 px-3 text-right">Sheet Qty</th>
                      <th className="py-2.5 px-3">Validation / Conflict Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {previewLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Validating worksheet columns via server endpoint...
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row) => (
                        <tr
                          key={row.rowNumber + row.sku}
                          className={
                            row.validationStatus === 'CONFLICT'
                              ? 'bg-amber-50/70'
                              : row.validationStatus === 'INVALID'
                              ? 'bg-rose-50/70'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-3 px-3 font-mono text-slate-500">
                            #{row.rowNumber}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">
                              {row.productName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {row.sku} • {row.category}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-500">
                            {row.baselineQty ?? '—'}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900">
                            {row.appCurrentQty ?? '—'} {row.unit}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-orange-600">
                            {row.sheetQty} {row.unit}
                          </td>
                          <td className="py-3 px-3">
                            {row.validationStatus === 'VALID' && (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>{row.validationMessage}</span>
                              </div>
                            )}

                            {row.validationStatus === 'INVALID' && (
                              <div className="flex items-start gap-1.5 text-rose-700 font-semibold">
                                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{row.validationMessage}</span>
                              </div>
                            )}

                            {row.validationStatus === 'CONFLICT' && (
                              <div className="space-y-2">
                                <div className="flex items-start gap-1.5 text-amber-900 font-semibold">
                                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{row.validationMessage}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConflictChoices({
                                        ...conflictChoices,
                                        [row.sku]: 'USE_SHEET',
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                                      conflictChoices[row.sku] === 'USE_SHEET'
                                        ? 'bg-orange-500 text-white border-orange-500'
                                        : 'bg-white text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    Accept Sheet ({row.sheetQty})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConflictChoices({
                                        ...conflictChoices,
                                        [row.sku]: 'USE_APP',
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                                      conflictChoices[row.sku] === 'USE_APP'
                                        ? 'bg-[#0B132B] text-white border-[#0B132B]'
                                        : 'bg-white text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    Keep App ({row.appCurrentQty})
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Manual Sync Action Bar */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Conflicting rows without an explicit resolution choice will be safely held without overwriting.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleManualSyncNow('IMPORT')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
                >
                  Import from Sheet
                </button>
                <button
                  onClick={() => handleManualSyncNow('EXPORT')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
                >
                  Push App Updates to Sheet
                </button>
                <button
                  onClick={() => handleManualSyncNow('BIDIRECTIONAL')}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  Sync Now (Bidirectional)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Synchronization History & Error Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <History className="h-4.5 w-4.5 text-orange-500" />
              Synchronization Audit & Error Log ({syncLogs.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete log of spreadsheet imports, exports, conflict holds, and validation events
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Vessel</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Processed</th>
                <th className="py-3 px-4 text-right">Updated</th>
                <th className="py-3 px-4 text-right">Conflicts</th>
                <th className="py-3 px-4">Result / Error Log Details</th>
                <th className="py-3 px-4">Initiated By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {syncLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {log.boatName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-700">
                    {log.direction}
                  </td>
                  <td className="py-3.5 px-4">
                    {log.isDemoMode ? (
                      <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                        Demo Mode
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                        Live API
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    {log.recordsProcessed}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600">
                    {log.recordsUpdated}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold">
                    {log.conflictsDetected > 0 ? (
                      <span className="text-amber-600">{log.conflictsDetected}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {log.errorMessage ? (
                      <span className="text-amber-800 font-medium">
                        {log.errorMessage}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        Synchronized cleanly without errors
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">
                    {log.initiatedByName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Connect New Boat Spreadsheet */}
      {newConnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              Connect Boat to Google Sheets
            </h3>
            <form onSubmit={handleConnectNewBoatSheet} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Select Vessel
                </label>
                <select
                  value={newBoatId}
                  onChange={(e) => setNewBoatId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {accessibleBoats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.registrationNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  required
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Google Spreadsheet ID
                </label>
                <input
                  type="text"
                  required
                  value={newSheetId}
                  onChange={(e) => setNewSheetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Worksheet Name
                </label>
                <input
                  type="text"
                  required
                  value={newWorksheet}
                  onChange={(e) => setNewWorksheet(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewConnModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold"
                >
                  Connect Spreadsheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
