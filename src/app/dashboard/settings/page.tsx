'use client';

import React, { useState } from 'react';
import {
  Database,
  RotateCcw,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { RoleBadge } from '@/components/ui/StatusBadge';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function SettingsPage() {
  const { currentUser, resetDemoState, addToast } = useFleet();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [lowStockEmailAlerts, setLowStockEmailAlerts] = useState(true);
  const [solasZeroToleranceAlert, setSolasZeroToleranceAlert] = useState(true);
  const [conflictHoldPolicy, setConflictHoldPolicy] = useState('HOLD_FOR_MANUAL_REVIEW');

  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'ADMIN') {
      addToast({
        type: 'error',
        title: 'Permission Denied',
        description: 'Only ADMIN users can modify critical system settings.',
      });
      return;
    }
    addToast({
      type: 'success',
      title: 'Platform Settings Saved',
      description: 'Maritime compliance thresholds and sync policies updated.',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Active User Clearance & Environment Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-500" />
              Platform & Security Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect active role permissions, database RLS configuration, and system preferences.
            </p>
          </div>
          <RoleBadge role={currentUser.role} />
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Active Session & RBAC Clearance
            </div>
            <p className="text-slate-600 mt-1.5">
              Signed in as <strong>{currentUser.fullName}</strong> ({currentUser.email})
            </p>
            <p className="text-slate-500 mt-1">
              {currentUser.role === 'ADMIN' &&
                'Full administrative authority: can manage users, boats, inventory specs, Google Sheets, and system settings.'}
              {currentUser.role === 'MASTER' &&
                'Fleet Master authority: can view assigned fleet compliance, approve restocks, and log stock movements. Cannot alter admin accounts or critical system settings.'}
              {currentUser.role === 'OWNER' &&
                'Owner authority: strictly isolated to assigned vessels. Can inspect inventory, submit restock requests, and export vessel reports.'}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Database className="h-4 w-4 text-orange-500" />
              Database & Integration Connection Status
            </div>
            <p className="text-slate-600 mt-1.5">
              Supabase PostgreSQL + RLS:{' '}
              <strong>
                {isSupabaseConfigured
                  ? 'Live Instance Connected'
                  : 'Stateful Local Persistence + SQL Migration Ready (supabase/migrations/001_initial_schema.sql)'}
              </strong>
            </p>
            <p className="text-slate-500 mt-1">
              Configure <code className="bg-white px-1 py-0.5 rounded border">.env.local</code>{' '}
              from <code className="bg-white px-1 py-0.5 rounded border">.env.example</code> to connect live Supabase and Google Service Account credentials.
            </p>
          </div>
        </div>
      </div>

      {/* System-Wide Compliance & Sync Settings (Editable by Admin Only) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <h3 className="text-base font-bold text-slate-950">
          Critical System & Synchronization Policies
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {currentUser.role === 'ADMIN'
            ? 'Configure global inventory compliance alerts and Google Sheets conflict behavior.'
            : 'Read-only view: Only ADMIN accounts can modify critical system-wide settings.'}
        </p>

        <form onSubmit={handleSaveSystemSettings} className="mt-5 space-y-4 text-xs">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-900">
                Automatic Low-Stock Notification Dispatch
              </p>
              <p className="text-slate-500">
                Emit in-app notifications whenever a vessel item drops below required specification.
              </p>
            </div>
            <input
              type="checkbox"
              disabled={currentUser.role !== 'ADMIN'}
              checked={lowStockEmailAlerts}
              onChange={(e) => setLowStockEmailAlerts(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-900">
                SOLAS Safety & Medical Zero-Tolerance Flagging
              </p>
              <p className="text-slate-500">
                Immediately escalate vessel status to Red (Critical Shortages) if any SOLAS item is below specification.
              </p>
            </div>
            <input
              type="checkbox"
              disabled={currentUser.role !== 'ADMIN'}
              checked={solasZeroToleranceAlert}
              onChange={(e) => setSolasZeroToleranceAlert(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-900">
                Google Sheets Bidirectional Conflict Handling Policy
              </p>
              <p className="text-slate-500">
                Determine how simultaneous edits in OctoFleet and Google Sheets are handled.
              </p>
            </div>
            <select
              disabled={currentUser.role !== 'ADMIN'}
              value={conflictHoldPolicy}
              onChange={(e) => setConflictHoldPolicy(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white"
            >
              <option value="HOLD_FOR_MANUAL_REVIEW">
                Hold Conflicting Rows for Manual Review (Recommended)
              </option>
              <option value="PREFER_APP">Prefer OctoFleet Application Values</option>
              <option value="PREFER_SHEET">Prefer Google Sheets Values</option>
            </select>
          </div>

          {currentUser.role === 'ADMIN' && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 text-xs font-bold"
              >
                Save System Policies
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Reset Demo Seed Data Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-950">
            Reset Interactive Maritime Seed Data
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Restore all vessels, inventory quantities, stock movements, restock requests, and Google Sheets conflicts to their clean initial state.
          </p>
        </div>

        <button
          onClick={() => setConfirmResetOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 text-xs font-bold shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Demo State
        </button>
      </div>

      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-950">
              Confirm State Reset
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              This will reset all local modifications and restore the default fleet seed data (M/Y Sovereign, M/Y Aurelia, S/Y Solaris, M/Y Borealis, and M/Y Mistral).
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmResetOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetDemoState();
                  setConfirmResetOpen(false);
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
