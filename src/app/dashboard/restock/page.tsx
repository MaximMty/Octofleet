'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Info,
  PackageCheck,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { useFleet } from '@/context/FleetContext';
import { RestockStatusBadge } from '@/components/ui/StatusBadge';
import { RestockRequest, RestockStatus } from '@/types/domain';

export default function RestockRequestsPage() {
  const {
    currentUser,
    accessibleBoats,
    accessibleInventory,
    accessibleRestockRequests,
    submitRestockRequest,
    reviewRestockRequest,
    recordGoodsReceived,
  } = useFleet();

  const [statusFilter, setStatusFilter] = useState<'ALL' | RestockStatus>('ALL');
  const [boatFilter, setBoatFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Submit New Restock Request Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedBoatId, setSelectedBoatId] = useState(
    accessibleBoats[0]?.id || 'boat-sovereign'
  );
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [requestedQty, setRequestedQty] = useState(15);
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('HIGH');
  const [reason, setReason] = useState('');

  // Master/Admin Review Modal
  const [reviewTarget, setReviewTarget] = useState<RestockRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>(
    'APPROVED'
  );
  const [reviewComment, setReviewComment] = useState('');

  const boatItemsForCreate = useMemo(() => {
    return accessibleInventory.filter((i) => i.boatId === selectedBoatId);
  }, [accessibleInventory, selectedBoatId]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleRestockRequests.filter((req) => {
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchesBoat = boatFilter === 'ALL' || req.boatId === boatFilter;
      const matchesQ =
        !q ||
        req.requestCode.toLowerCase().includes(q) ||
        req.productName.toLowerCase().includes(q) ||
        req.boatName.toLowerCase().includes(q) ||
        req.requestedByName.toLowerCase().includes(q) ||
        req.reason.toLowerCase().includes(q);
      return matchesStatus && matchesBoat && matchesQ;
    });
  }, [accessibleRestockRequests, statusFilter, boatFilter, search]);

  const openCreateModal = () => {
    const firstBoat = accessibleBoats[0]?.id || 'boat-sovereign';
    setSelectedBoatId(firstBoat);
    const items = accessibleInventory.filter((i) => i.boatId === firstBoat);
    const firstLow = items.find((i) => i.missingQty > 0) || items[0];
    if (firstLow) {
      setSelectedInventoryId(firstLow.id);
      setRequestedQty(firstLow.missingQty > 0 ? firstLow.missingQty : 10);
      setReason(
        `Replenish ${firstLow.productName} to required vessel specification (${firstLow.requiredQty} ${firstLow.unit}).`
      );
    }
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedInventoryId || boatItemsForCreate[0]?.id;
    if (!targetId) return;
    const res = submitRestockRequest({
      boatInventoryId: targetId,
      requestedQty: Number(requestedQty),
      priority,
      reason,
    });
    if (res.ok) {
      setCreateModalOpen(false);
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    const res = reviewRestockRequest({
      requestId: reviewTarget.id,
      decision: reviewDecision,
      comment: reviewComment,
    });
    if (res.ok) {
      setReviewTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* MVP Procurement Rule Banner */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900">
          <p className="font-bold">
            Two-Stage Maritime Procurement & Stock Integrity Policy
          </p>
          <p className="mt-0.5 leading-relaxed">
            Approving a restock request authorizes shore procurement and records an audit comment, but <strong>does not automatically modify onboard stock</strong>. Actual vessel inventory only increments when physical goods are received onboard and recorded via <strong>&ldquo;Record Goods Received&rdquo;</strong>.
          </p>
        </div>
      </div>

      {/* Top Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Restock Requests & Approval Queue ({filteredRequests.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track owner replenishment requests, Fleet Master approvals, and onboard delivery verification.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs self-start"
        >
          <Plus className="h-4 w-4" />
          New Restock Request
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
            placeholder="Search request code, product, boat, or requester..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by Boat"
            value={boatFilter}
            onChange={(e) => setBoatFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
          >
            <option value="ALL">All Accessible Boats</option>
            {accessibleBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Request Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | RestockStatus)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-medium"
          >
            <option value="ALL">All Request Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved (Awaiting Delivery)</option>
            <option value="FULFILLED">Goods Received (Fulfilled)</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Request Code & Date</th>
                <th className="py-3.5 px-4">Boat</th>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4 text-right">Stock Snapshot</th>
                <th className="py-3.5 px-4 text-right">Requested Qty</th>
                <th className="py-3.5 px-4">Reason & Review Audit</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No restock requests match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80">
                    <td className="py-4 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {req.requestCode}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(req.createdAt).toLocaleString()}
                      </div>
                      <span
                        className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          req.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-700'
                            : req.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-900">
                      {req.boatName}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{req.productName}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {req.sku} • {req.categoryName}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right tabular-nums text-slate-600">
                      {req.currentQtySnapshot} / {req.requiredQtySnapshot} {req.unit}
                    </td>
                    <td className="py-4 px-4 text-right tabular-nums font-bold text-orange-600">
                      +{req.requestedQty} {req.unit}
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="text-slate-800 font-medium">{req.reason}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Requested by: {req.requestedByName}
                      </p>
                      {req.reviewComment && (
                        <div className="mt-1.5 rounded bg-slate-100 p-2 text-[11px] text-slate-700 border border-slate-200">
                          <strong>{req.reviewerName}:</strong> {req.reviewComment}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <RestockStatusBadge status={req.status} />
                    </td>
                    <td className="py-4 px-4 text-right">
                      {currentUser.role !== 'OWNER' && req.status === 'PENDING' && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setReviewTarget(req);
                              setReviewDecision('APPROVED');
                              setReviewComment(
                                'Approved for immediate chandlery procurement. Record delivery once onboard.'
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-[11px] font-bold"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setReviewTarget(req);
                              setReviewDecision('REJECTED');
                              setReviewComment(
                                'Deferred until scheduled port call.'
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      )}

                      {currentUser.role !== 'OWNER' && req.status === 'APPROVED' && (
                        <button
                          onClick={() => recordGoodsReceived(req.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white px-3 py-1.5 text-[11px] font-bold"
                        >
                          <PackageCheck className="h-3.5 w-3.5 text-orange-400" />
                          Record Goods Received
                        </button>
                      )}

                      {(currentUser.role === 'OWNER' ||
                        req.status === 'FULFILLED' ||
                        req.status === 'REJECTED') && (
                        <span className="text-[11px] text-slate-400">
                          {req.status === 'FULFILLED'
                            ? 'Stock updated'
                            : req.status === 'PENDING'
                            ? 'Awaiting Master'
                            : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit New Restock Request Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-orange-500" />
              Submit New Restock Request
            </h3>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Boat
                </label>
                <select
                  value={selectedBoatId}
                  onChange={(e) => {
                    const nextBoat = e.target.value;
                    setSelectedBoatId(nextBoat);
                    const nextItems = accessibleInventory.filter(
                      (i) => i.boatId === nextBoat
                    );
                    if (nextItems[0]) {
                      setSelectedInventoryId(nextItems[0].id);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {accessibleBoats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Product
                </label>
                <select
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {boatItemsForCreate.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productName} ({item.currentQty}/{item.requiredQty} {item.unit} —{' '}
                      {item.missingQty} missing)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Requested Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={requestedQty}
                    onChange={(e) => setRequestedQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'NORMAL' | 'HIGH' | 'URGENT')
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 text-xs font-bold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master/Admin Review & Comment Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              {reviewDecision === 'APPROVED' ? 'Approve' : 'Reject'} Request{' '}
              {reviewTarget.requestCode}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {reviewTarget.boatName} • {reviewTarget.productName} (+
              {reviewTarget.requestedQty} {reviewTarget.unit})
            </p>
            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Decision
                </label>
                <select
                  value={reviewDecision}
                  onChange={(e) =>
                    setReviewDecision(e.target.value as 'APPROVED' | 'REJECTED')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                >
                  <option value="APPROVED">
                    Approve Request (Authorize Procurement)
                  </option>
                  <option value="REJECTED">Reject Request</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Master / Reviewer Comment
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`rounded-lg px-4 py-2 text-xs font-bold text-white ${
                    reviewDecision === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {reviewDecision === 'APPROVED' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
