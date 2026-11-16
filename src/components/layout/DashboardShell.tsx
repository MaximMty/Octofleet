'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Anchor,
  Bell,
  Boxes,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  X,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { RoleBadge } from '@/components/ui/StatusBadge';
import { UserRole } from '@/types/domain';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
  badgeCount?: number;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentUser,
    users,
    switchUserById,
    logout,
    accessibleNotifications,
    accessibleRestockRequests,
    integrations,
    markNotificationRead,
    markAllNotificationsRead,
    toasts,
    dismissToast,
  } = useFleet();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const pendingRestocks = accessibleRestockRequests.filter(
    (r) => r.status === 'PENDING'
  ).length;
  const unreadNotifications = accessibleNotifications.filter((n) => !n.isRead);
  const conflictCount = integrations.reduce(
    (acc, i) => acc + (i.pendingConflictsCount || 0),
    0
  );

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['ADMIN', 'MASTER', 'OWNER'],
    },
    {
      label: 'Fleet / Boats',
      href: '/dashboard/boats',
      icon: Ship,
      allowedRoles: ['ADMIN', 'MASTER', 'OWNER'],
    },
    {
      label: 'Inventory',
      href: '/dashboard/inventory',
      icon: Boxes,
      allowedRoles: ['ADMIN', 'MASTER', 'OWNER'],
    },
    {
      label: 'Restock Requests',
      href: '/dashboard/restock',
      icon: ClipboardList,
      allowedRoles: ['ADMIN', 'MASTER', 'OWNER'],
      badgeCount: pendingRestocks > 0 ? pendingRestocks : undefined,
    },
    {
      label: 'Reports',
      href: '/dashboard/reports',
      icon: FileBarChart2,
      allowedRoles: ['ADMIN', 'MASTER', 'OWNER'],
    },
    {
      label: 'Users',
      href: '/dashboard/users',
      icon: Users,
      allowedRoles: ['ADMIN'],
    },
    {
      label: 'Integrations',
      href: '/dashboard/integrations',
      icon: FileSpreadsheet,
      allowedRoles: ['ADMIN'],
      badgeCount: conflictCount > 0 ? conflictCount : undefined,
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      allowedRoles: ['ADMIN', 'MASTER', 'OWNER'],
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.allowedRoles.includes(currentUser.role)
  );

  // Compute breadcrumbs & page title
  const segments = pathname.split('/').filter(Boolean);
  const pageTitleMap: Record<string, string> = {
    dashboard:
      currentUser.role === 'ADMIN'
        ? 'Command & Fleet Overview'
        : currentUser.role === 'MASTER'
        ? 'Fleet Master Compliance Desk'
        : 'Owner Vessel Portal',
    boats: 'Fleet & Vessel Registry',
    inventory: 'Inventory & Stock Ledger',
    restock: 'Restock & Procurement Requests',
    reports: 'Fleet Compliance Reports & Analytics',
    users: 'User & Access Control (RBAC)',
    integrations: 'Google Sheets Synchronization Hub',
    settings: 'Platform & Security Settings',
  };

  const lastSegment = segments[segments.length - 1] || 'dashboard';
  const currentTitle =
    pageTitleMap[lastSegment] ||
    (segments[1] === 'boats' && segments.length === 3
      ? 'Vessel Specification & Inventory Profile'
      : 'Dashboard');

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Desktop Collapsible Sidebar (Aquator Marine Dark Navy Aesthetic) */}
      <aside
        className={`hidden lg:flex flex-col bg-[#0B132B] text-slate-200 border-r border-slate-800/80 transition-all duration-200 shrink-0 ${
          collapsed ? 'w-20' : 'w-68'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Anchor className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-white text-base leading-none">
                  OCTOFLEET
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
                  Maritime Systems
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Active Role Clearance Card */}
        {!collapsed && (
          <div className="mx-3 mt-4 p-3 rounded-lg bg-slate-900/90 border border-slate-800/90">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Active Clearance
              </span>
              <RoleBadge role={currentUser.role} />
            </div>
            <p className="text-xs font-semibold text-white mt-1.5 truncate">
              {currentUser.fullName}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{currentUser.title}</p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/75 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-orange-400'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!collapsed && item.badgeCount !== undefined && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                      isActive
                        ? 'bg-white text-orange-600'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer RLS Indicator */}
        <div className="p-3 border-t border-slate-800/80">
          {!collapsed ? (
            <div className="rounded-lg bg-slate-900/70 px-3 py-2.5 border border-slate-800/70">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>RLS Policy Enforced</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                {currentUser.role === 'ADMIN'
                  ? 'Full fleet & configuration authority'
                  : currentUser.role === 'MASTER'
                  ? 'Scoped to assigned fleet vessels'
                  : 'Strictly isolated to owned vessels'}
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-1" title="RLS Policy Enforced">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0B132B] text-white flex flex-col z-10">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                  <Anchor className="h-4.5 w-4.5" />
                </div>
                <span className="font-bold tracking-tight">OCTOFLEET</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Signed in as</span>
                <RoleBadge role={currentUser.role} />
              </div>
              <p className="text-sm font-semibold">{currentUser.fullName}</p>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                    </div>
                    {item.badgeCount !== undefined && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300">
                        {item.badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          {/* Left: Mobile Trigger + Breadcrumbs & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link href="/dashboard" className="hover:text-orange-600 transition-colors">
                  OctoFleet
                </Link>
                {segments.slice(1).map((seg, i) => (
                  <React.Fragment key={seg + i}>
                    <span>/</span>
                    <span className="capitalize truncate max-w-[160px]">
                      {seg.replace('boat-', 'Vessel: ')}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {currentTitle}
              </h1>
            </div>
          </div>

          {/* Right: Role/Account Switcher + Notifications + User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Quick Role & Account Switcher for Interactive RBAC Verification */}
            <div className="hidden md:flex items-center gap-2 bg-slate-100/90 border border-slate-200/90 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Role View:
              </span>
              <select
                aria-label="Switch Active User Profile"
                value={currentUser.id}
                onChange={(e) => switchUserById(e.target.value)}
                className="bg-white text-xs font-semibold text-slate-800 rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {users
                  .filter((u) => u.isActive)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      [{user.role}] {user.fullName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileMenuOpen(false);
                }}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-88 sm:w-96 rounded-xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Fleet Telemetry & Alerts
                      </h3>
                      <p className="text-xs text-slate-500">
                        {unreadNotifications.length} unread alert(s) for your clearance
                      </p>
                    </div>
                    {unreadNotifications.length > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {accessibleNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No notifications for your assigned vessels.
                      </div>
                    ) : (
                      accessibleNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 hover:bg-slate-50 transition-colors ${
                            !n.isRead ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-block h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                                n.severity === 'CRITICAL'
                                  ? 'bg-rose-600'
                                  : n.severity === 'WARNING'
                                  ? 'bg-amber-500'
                                  : n.severity === 'SUCCESS'
                                  ? 'bg-emerald-500'
                                  : 'bg-sky-500'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900">
                                {n.title}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                {n.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[11px] text-slate-400">
                                  {new Date(n.createdAt).toLocaleString()}
                                </span>
                                <Link
                                  href={n.actionUrl}
                                  onClick={() => {
                                    markNotificationRead(n.id);
                                    setNotifOpen(false);
                                  }}
                                  className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                                >
                                  Inspect →
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileMenuOpen(!profileMenuOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
              >
                <div className="h-7 w-7 rounded-md bg-[#0B132B] text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-slate-900 leading-none">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mt-0.5">
                    {currentUser.role}
                  </span>
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-slate-200 z-50 py-2">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">
                      {currentUser.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {currentUser.email}
                    </p>
                    <div className="mt-2">
                      <RoleBadge role={currentUser.role} />
                    </div>
                  </div>

                  {/* Mobile Role Switcher inside Profile Dropdown */}
                  <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                      Switch Active Profile
                    </label>
                    <select
                      value={currentUser.id}
                      onChange={(e) => {
                        switchUserById(e.target.value);
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    >
                      {users
                        .filter((u) => u.isActive)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            [{u.role}] {u.fullName}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4 text-slate-400" />
                      Account & Platform Settings
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Users className="h-4 w-4 text-slate-400" />
                      Switch Account / Login Page
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setProfileMenuOpen(false);
                        router.push('/login');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Floating Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl border p-4 shadow-lg bg-white flex items-start justify-between gap-3 transition-all ${
                t.type === 'error'
                  ? 'border-rose-200 bg-rose-50/95 text-rose-900'
                  : t.type === 'warning'
                  ? 'border-amber-200 bg-amber-50/95 text-amber-900'
                  : t.type === 'success'
                  ? 'border-emerald-200 bg-white text-slate-900'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
