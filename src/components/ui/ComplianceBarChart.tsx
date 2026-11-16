'use client';

import React from 'react';

export interface ChartBarItem {
  label: string;
  subLabel?: string;
  value: number; // 0 to 100
  color?: 'emerald' | 'orange' | 'amber' | 'rose';
}

export function ComplianceBarChart({
  data,
  height = 210,
}: {
  data: ChartBarItem[];
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg"
      >
        No chart telemetry available
      </div>
    );
  }

  const getBarColorClass = (item: ChartBarItem) => {
    if (item.color === 'emerald') return 'bg-emerald-500';
    if (item.color === 'amber') return 'bg-amber-500';
    if (item.color === 'rose') return 'bg-rose-500';
    if (item.color === 'orange') return 'bg-orange-500';
    if (item.value === 100) return 'bg-emerald-500';
    if (item.value >= 75) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  return (
    <div style={{ height }} className="w-full flex flex-col justify-between pt-2 pb-1">
      {/* Plot Area */}
      <div className="relative flex-1 flex items-end gap-3 border-b border-l border-slate-800 px-3 pt-4">
        {/* Horizontal Grid Lines */}
        {[100, 75, 50, 25].map((pct) => (
          <div
            key={pct}
            style={{ bottom: `${pct}%` }}
            className="absolute left-0 right-0 border-t border-dashed border-slate-800/80 pointer-events-none flex items-center"
          >
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 pr-1.5 -mt-2">
              {pct}%
            </span>
          </div>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const clamped = Math.max(0, Math.min(100, item.value));
          return (
            <div
              key={item.label + idx}
              className="relative z-10 flex-1 h-full flex flex-col justify-end items-center group"
            >
              {/* Value Pill on Hover / Top */}
              <span className="mb-1 text-[11px] font-bold tabular-nums text-slate-200">
                {clamped}%
              </span>
              <div
                style={{ height: `${Math.max(clamped, 4)}%` }}
                className={`w-full max-w-[44px] rounded-t-md transition-all duration-300 ${getBarColorClass(
                  item
                )} group-hover:brightness-110`}
                title={`${item.subLabel || item.label}: ${clamped}%`}
              />
            </div>
          );
        })}
      </div>

      {/* X-Axis Labels */}
      <div className="flex items-center gap-3 px-3 pt-2">
        {data.map((item, idx) => (
          <div key={item.label + idx} className="flex-1 text-center min-w-0">
            <p className="text-[11px] font-bold text-slate-300 truncate">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
