'use client';

import React, { useMemo, useState } from 'react';
import {
  Edit3,
  Lock,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { RoleBadge } from '@/components/ui/StatusBadge';
import { UserProfile, UserRole } from '@/types/domain';

export default function UsersManagementPage() {
  const {
    currentUser,
    users,
    accessibleBoats,
    createOrUpdateUser,
    toggleUserActive,
    switchUserById,
  } = useFleet();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | undefined>(undefined);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('OWNER');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Confirmation modal for deactivating a user
  const [confirmDeactivateUser, setConfirmDeactivateUser] =
    useState<UserProfile | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesQ =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q);
      return matchesRole && matchesQ;
    });
  }, [users, search, roleFilter]);

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
          Only <strong>ADMIN</strong> accounts can view, create, edit, or deactivate user accounts and assign system roles.
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingUserId(undefined);
    setFullName('');
    setEmail('');
    setRole('OWNER');
    setTitle('Principal Vessel Owner');
    setPhone('+377 98 06 00 00');
    setIsActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUserId(u.id);
    setFullName(u.fullName);
    setEmail(u.email);
    setRole(u.role);
    setTitle(u.title);
    setPhone(u.phone);
    setIsActive(u.isActive);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const res = createOrUpdateUser({
      id: editingUserId,
      fullName,
      email,
      role,
      title,
      phone,
      isActive,
    });
    if (!res.ok) {
      setFormError(res.error || 'Could not save user profile.');
      return;
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            User & Role Access Control ({filteredUsers.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, edit, and deactivate maritime users. Assign ADMIN, MASTER, or OWNER clearances.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs self-start"
        >
          <Plus className="h-4 w-4" />
          Create User Account
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or title..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300"
          />
        </div>

        <select
          aria-label="Filter by User Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
          className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
        >
          <option value="ALL">All Roles</option>
          <option value="ADMIN">ADMIN (Full Access)</option>
          <option value="MASTER">MASTER (Fleet-Wide Assigned)</option>
          <option value="OWNER">OWNER (Strictly Boat-Isolated)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Full Name & Title</th>
                <th className="py-3.5 px-4">Email & Phone</th>
                <th className="py-3.5 px-4">Role Clearance</th>
                <th className="py-3.5 px-4">Assigned Vessels</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.map((user) => {
                const assignedBoats = accessibleBoats.filter(
                  (b) =>
                    user.role === 'ADMIN' ||
                    b.ownerId === user.id ||
                    b.masterId === user.id ||
                    b.additionalOwnerIds?.includes(user.id)
                );

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{user.fullName}</div>
                      <div className="text-[11px] text-slate-500">{user.title}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-mono text-slate-800">{user.email}</div>
                      <div className="text-[11px] text-slate-500">{user.phone}</div>
                    </td>
                    <td className="py-4 px-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="py-4 px-4">
                      {user.role === 'ADMIN' ? (
                        <span className="text-slate-600 font-medium">
                          All Fleet Vessels ({accessibleBoats.length})
                        </span>
                      ) : assignedBoats.length === 0 ? (
                        <span className="text-slate-400">No vessels assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {assignedBoats.map((b) => (
                            <span
                              key={b.id}
                              className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-800"
                            >
                              {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {user.isActive && user.id !== currentUser.id && (
                          <button
                            onClick={() => switchUserById(user.id)}
                            className="rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold"
                            title="Impersonate / Test Role View"
                          >
                            Test Role
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(user)}
                          className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => setConfirmDeactivateUser(user)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1 ${
                              user.isActive
                                ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="h-3 w-3" />
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              {editingUserId ? 'Edit User & Role Clearance' : 'Create Maritime User'}
            </h3>
            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Role Clearance
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MASTER">MASTER</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Maritime Title / Position
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {formError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Destructive Deactivation Action */}
      {confirmDeactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-950">
              {confirmDeactivateUser.isActive
                ? 'Confirm User Account Deactivation'
                : 'Reactivate User Account'}
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {confirmDeactivateUser.isActive
                ? `Are you sure you want to deactivate ${confirmDeactivateUser.fullName} (${confirmDeactivateUser.role})? They will immediately lose access to OctoFleet dashboards and vessel telemetry.`
                : `Reactivate ${confirmDeactivateUser.fullName} and restore their ${confirmDeactivateUser.role} permissions?`}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmDeactivateUser(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toggleUserActive(confirmDeactivateUser.id);
                  setConfirmDeactivateUser(null);
                }}
                className={`rounded-lg px-4 py-2 text-xs font-bold text-white ${
                  confirmDeactivateUser.isActive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmDeactivateUser.isActive
                  ? 'Confirm Deactivate'
                  : 'Confirm Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
