'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Anchor, ArrowLeft, ArrowRight, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { RoleBadge } from '@/components/ui/StatusBadge';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { users, currentUser, loginAsUser } = useFleet();
  const [emailInput, setEmailInput] = useState(currentUser.email);
  const [passwordInput, setPasswordInput] = useState('••••••••••••');
  const [error, setError] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = loginAsUser(emailInput);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Invalid or deactivated maritime credentials. Select an active account below.');
    }
  };

  const handleQuickRoleSelect = (userId: string, userEmail: string) => {
    setEmailInput(userEmail);
    const success = loginAsUser(userId);
    if (success) {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#060B16] text-slate-100 flex flex-col justify-between p-6 lg:p-10">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center text-white">
            <Anchor className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white block leading-none">
              OCTOFLEET
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">
              Maritime Authentication Gate
            </span>
          </div>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Public Homepage
        </Link>
      </div>

      {/* Main Auth Grid */}
      <div className="max-w-6xl w-full mx-auto my-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Credentials Sign-In Card */}
        <div className="lg:col-span-5 bg-slate-900 text-slate-100 rounded-2xl p-8 shadow-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white">Sign in to OctoFleet</h1>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate with your maritime crew or owner profile
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-orange-400">
              <Lock className="h-5 w-5" />
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Maritime Email Address
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="m.vance@octofleet.maritime"
                className="w-full rounded-lg border border-slate-700 bg-[#0A1122] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Passphrase
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#0A1122] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-3 text-xs font-medium text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
            >
              Access Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {isSupabaseConfigured
                ? 'Connected to live Supabase Auth & RLS instance.'
                : 'Running in interactive Stateful Session Mode. Select any account on the right to inspect role-specific dashboards and RLS boat isolation.'}
            </span>
          </div>
        </div>

        {/* Right: Interactive Role & Account Selector for Testing ADMIN, MASTER, and OWNER */}
        <div className="lg:col-span-7 bg-[#0A1122] border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
                Role-Based Access Control (RBAC)
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                One-Click Role Verification Accounts
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Click any account below to immediately launch the dashboard with that user&apos;s permissions and boat assignments.
              </p>
            </div>
            <UserCheck className="h-6 w-6 text-orange-400 hidden sm:block" />
          </div>

          <div className="space-y-3">
            {users.map((u) => {
              const isCurrent = u.id === currentUser.id;
              return (
                <div
                  key={u.id}
                  className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrent
                      ? 'border-orange-500 bg-slate-900'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <RoleBadge role={u.role} />
                      <span className="text-sm font-bold text-white">{u.fullName}</span>
                      {!u.isActive && (
                        <span className="text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">{u.title}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                  </div>

                  <button
                    disabled={!u.isActive}
                    onClick={() => handleQuickRoleSelect(u.id, u.email)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                      !u.isActive
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : isCurrent
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-slate-800 text-white hover:bg-orange-500'
                    }`}
                  >
                    {isCurrent ? 'Continue as Active' : `Sign in as ${u.role}`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500">
        OctoFleet Enterprise Yacht Management • Enforced Backend & Supabase RLS Permissions
      </div>
    </div>
  );
}
