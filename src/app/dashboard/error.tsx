'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('OctoFleet Dashboard Error:', error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto my-12 rounded-2xl border border-rose-500/30 bg-slate-900 p-8 text-center shadow-2xl">
      <div className="h-12 w-12 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-white">
        Dashboard Telemetry Interrupted
      </h2>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
        {error.message || 'An unexpected client error occurred while rendering this view.'}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={() => {
            try {
              localStorage.removeItem('octofleet_enterprise_state_v1');
            } catch {
              // ignore
            }
            reset();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Reset State & Reload Dashboard
        </button>
      </div>
    </div>
  );
}
