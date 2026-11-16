import React from 'react';
import Link from 'next/link';
import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  Ship,
} from 'lucide-react';
import LuxuryYachtHero from '@/components/hero/LuxuryYachtHero';

export default function PublicHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#060B16] text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Minimal Maritime Dark Header (DeepBlue Inspiration) */}
      <header className="border-b border-slate-800/80 bg-[#0A1122]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-sm">
              <Anchor className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block leading-none">
                OCTOFLEET
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mt-1 block">
                Maritime Inventory Systems
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#capabilities" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#workflow" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#roles" className="hover:text-white transition-colors">
              Access Architecture
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
            >
              Access Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Interactive 3D Superyacht Full-Viewport Hero Section */}
      <LuxuryYachtHero />

      {/* Brief Feature Highlights */}
      <section id="capabilities" className="py-24 border-b border-slate-800/80 bg-[#0A1122]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-400">
              Core Capabilities
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white mt-2">
              Engineered for maritime management companies, captains, and owners.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-xl border border-slate-800 p-7 bg-slate-900/90">
              <div className="h-10 w-10 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center mb-5">
                <Ship className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Real-Time Specification Compliance
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Track required versus current quantities across Provisioning, Engine Room, SOLAS Safety, Deck, and Housekeeping categories with automatic missing-unit calculations.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 p-7 bg-slate-900/90">
              <div className="h-10 w-10 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center mb-5">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Conflict-Safe Google Sheets Sync
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Connect vessel spreadsheets with custom column mapping and pre-import validation. Simultaneous edits in the app and worksheet are flagged for review rather than overwritten.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 p-7 bg-slate-900/90">
              <div className="h-10 w-10 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center mb-5">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Strict Role & Owner Isolation
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Admins configure fleet standards, Masters oversee compliance and approve restocks across assigned vessels, and Owners see a dedicated portal strictly isolated to their boats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How the Platform Works */}
      <section id="workflow" className="py-24 bg-[#060B16] text-white border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-400">
                Operational Workflow
              </p>
              <h2 className="text-3xl font-bold tracking-tight mt-2">
                How OctoFleet keeps every vessel charter-ready.
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors self-start"
            >
              Launch Live Platform
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Configure Boat Specs',
                desc: 'Admins register vessels, assign Owners and Fleet Masters, and define required inventory thresholds or link Google Sheets.',
              },
              {
                step: '02',
                title: 'Monitor Stock & Movements',
                desc: 'Every addition, consumption, adjustment, or transfer is logged with user attribution, previous/new quantities, and timestamps.',
              },
              {
                step: '03',
                title: 'Submit & Approve Restocks',
                desc: 'Owners submit restock requests for missing items. Fleet Masters review and approve requests before shore procurement.',
              },
              {
                step: '04',
                title: 'Verify Delivery & Export',
                desc: 'Stock quantities update only when goods are physically received onboard. Generate compliance CSV reports at any time.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold font-mono text-orange-400">
                    STEP {item.step}
                  </span>
                  <h3 className="text-base font-bold text-white mt-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Verified Audit Trail</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Summary Section */}
      <section id="roles" className="py-20 bg-[#0A1122] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Three-Tier Maritime Access Control
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Test all three role perspectives immediately inside the application.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors self-start"
            >
              <Layers className="h-4 w-4 text-orange-400" />
              Select Role & Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Clean Dark Footer */}
      <footer className="bg-[#060B16] py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-orange-500 flex items-center justify-center text-white">
              <Anchor className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-white">OCTOFLEET</span>
            <span>— Yacht Inventory & Fleet Management Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            <Link href="/login" className="hover:text-white">
              Role Login
            </Link>
            <span>© {new Date().getFullYear()} OctoFleet Maritime Systems</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
