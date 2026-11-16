import React from 'react';
import {
  ComplianceStatus,
  MovementType,
  RestockStatus,
  SyncStatus,
  UserRole,
} from '@/types/domain';

export function ComplianceBadge({
  status,
  labelOverride,
}: {
  status: ComplianceStatus;
  labelOverride?: string;
}) {
  if (status === 'MEETS_SPEC') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        {labelOverride || 'Meets Specifications'}
      </span>
    );
  }
  if (status === 'ATTENTION') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/25">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {labelOverride || 'Needs Attention'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/25">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
      {labelOverride || 'Critical Shortages'}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'ADMIN') {
    return (
      <span className="inline-flex items-center rounded bg-orange-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-orange-500 ring-1 ring-inset ring-orange-500/30">
        ADMIN
      </span>
    );
  }
  if (role === 'MASTER') {
    return (
      <span className="inline-flex items-center rounded bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-400 ring-1 ring-inset ring-sky-500/30">
        MASTER
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
      OWNER
    </span>
  );
}

export function RestockStatusBadge({ status }: { status: RestockStatus }) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/25">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Pending Review
        </span>
      );
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/25">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
          Approved (Awaiting Delivery)
        </span>
      );
    case 'FULFILLED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Goods Received
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          Rejected
        </span>
      );
  }
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  switch (type) {
    case 'ADDED':
      return (
        <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          + Stock Added
        </span>
      );
    case 'REMOVED':
      return (
        <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
          − Stock Removed
        </span>
      );
    case 'ADJUSTED':
      return (
        <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
          ± Audit Adjusted
        </span>
      );
    case 'TRANSFERRED':
      return (
        <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
          ⇄ Transferred
        </span>
      );
  }
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'CONNECTED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Synchronized
        </span>
      );
    case 'CONFLICT':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/25">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Conflict Detected
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/25">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
          Sync Error
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/20">
          {status}
        </span>
      );
  }
}
