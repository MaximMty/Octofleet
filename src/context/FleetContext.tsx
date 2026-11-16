'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppNotification,
  AuditLog,
  Boat,
  BoatInventoryItem,
  ColumnMapping,
  ComputedBoatSummary,
  ComputedInventoryItem,
  GoogleSheetIntegration,
  InventoryCategory,
  MovementType,
  RestockRequest,
  StockMovement,
  SyncLog,
  UserProfile,
  UserRole,
} from '@/types/domain';
import {
  SEED_AUDIT_LOGS,
  SEED_BOATS,
  SEED_CATEGORIES,
  SEED_INTEGRATIONS,
  SEED_INVENTORY,
  SEED_NOTIFICATIONS,
  SEED_RESTOCK_REQUESTS,
  SEED_STOCK_MOVEMENTS,
  SEED_SYNC_LOGS,
  SEED_USERS,
} from '@/lib/seed-data';
import {
  canUserAccessBoat,
  computeBoatSummary,
  enrichInventoryItem,
  getAccessibleBoats,
} from '@/lib/inventory-math';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
}

interface FleetContextValue {
  // Auth & Active User
  currentUser: UserProfile;
  users: UserProfile[];
  switchUserById: (userId: string) => void;
  switchRoleQuick: (role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loginAsUser: (emailOrId: string) => boolean;

  // Filtered by RBAC
  accessibleBoats: ComputedBoatSummary[];
  accessibleInventory: ComputedInventoryItem[];
  accessibleMovements: StockMovement[];
  accessibleRestockRequests: RestockRequest[];
  accessibleNotifications: AppNotification[];
  categories: InventoryCategory[];
  integrations: GoogleSheetIntegration[];
  syncLogs: SyncLog[];
  auditLogs: AuditLog[];

  // Helpers
  canAccessBoatId: (boatId: string) => boolean;
  getBoatById: (boatId: string) => ComputedBoatSummary | null;
  getBoatInventory: (boatId: string) => ComputedInventoryItem[];

  // Mutations — Boats
  createOrUpdateBoat: (
    payload: Omit<Boat, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => { ok: boolean; error?: string; boatId?: string };
  updateBoatMmsi: (boatId: string, mmsi: string) => { ok: boolean; error?: string };

  // Mutations — Inventory & Stock Movements
  createOrUpdateInventoryItem: (
    payload: Omit<BoatInventoryItem, 'id' | 'lastUpdatedAt' | 'lastUpdatedBy'> & { id?: string }
  ) => { ok: boolean; error?: string };
  recordStockMovement: (payload: {
    boatInventoryId: string;
    movementType: MovementType;
    quantity: number; // for ADDED/REMOVED/TRANSFERRED this is delta magnitude; for ADJUSTED this is new exact quantity
    reason: string;
    referenceCode?: string;
    targetBoatId?: string; // for TRANSFERRED
  }) => { ok: boolean; error?: string };

  // Mutations — Restock Requests
  submitRestockRequest: (payload: {
    boatInventoryId: string;
    requestedQty: number;
    priority: 'NORMAL' | 'HIGH' | 'URGENT';
    reason: string;
  }) => { ok: boolean; error?: string };
  reviewRestockRequest: (payload: {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    comment: string;
  }) => { ok: boolean; error?: string };
  recordGoodsReceived: (requestId: string) => { ok: boolean; error?: string };

  // Mutations — Users (Admin only)
  createOrUpdateUser: (
    payload: Omit<UserProfile, 'id' | 'createdAt'> & { id?: string }
  ) => { ok: boolean; error?: string };
  toggleUserActive: (userId: string) => { ok: boolean; error?: string };

  // Mutations — Google Sheets Integration (Admin only)
  saveSheetIntegration: (payload: {
    id?: string;
    boatId: string;
    spreadsheetId: string;
    spreadsheetName: string;
    worksheetName: string;
    columnMapping: ColumnMapping;
    syncDirection: 'BIDIRECTIONAL' | 'IMPORT_ONLY' | 'EXPORT_ONLY';
  }) => { ok: boolean; error?: string };
  executeSheetSync: (payload: {
    integrationId: string;
    direction: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL';
    conflictResolution?: Record<string, 'USE_SHEET' | 'USE_APP'>;
  }) => { ok: boolean; message: string; conflictsCount: number };

  // Notifications & Toasts
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  resetDemoState: () => void;
}

const STORAGE_KEY = 'octofleet_enterprise_state_v1';

const FleetContext = createContext<FleetContextValue | null>(null);

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<UserProfile[]>(SEED_USERS);
  const [currentUserId, setCurrentUserId] = useState<string>('usr-admin-1');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [boats, setBoats] = useState<Boat[]>(SEED_BOATS);
  const [categories] = useState<InventoryCategory[]>(SEED_CATEGORIES);
  const [inventory, setInventory] = useState<BoatInventoryItem[]>(SEED_INVENTORY);
  const [movements, setMovements] = useState<StockMovement[]>(SEED_STOCK_MOVEMENTS);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>(SEED_RESTOCK_REQUESTS);
  const [integrations, setIntegrations] = useState<GoogleSheetIntegration[]>(SEED_INTEGRATIONS);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(SEED_SYNC_LOGS);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(SEED_AUDIT_LOGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.users?.length) setUsers(parsed.users);
        if (parsed.currentUserId) setCurrentUserId(parsed.currentUserId);
        if (typeof parsed.isAuthenticated === 'boolean') setIsAuthenticated(parsed.isAuthenticated);
        if (parsed.boats?.length) {
          const seedMap = new Map(SEED_BOATS.map((b) => [b.id, b]));
          setBoats(
            parsed.boats.map((b: Boat) => {
              const seed = seedMap.get(b.id);
              return {
                ...b,
                imageUrl: b.imageUrl || seed?.imageUrl || '/boats/sovereign.jpg',
                mmsi: b.mmsi !== undefined ? b.mmsi : seed?.mmsi,
              };
            })
          );
        }
        if (parsed.inventory?.length) setInventory(parsed.inventory);
        if (parsed.movements?.length) setMovements(parsed.movements);
        if (parsed.restockRequests?.length) setRestockRequests(parsed.restockRequests);
        if (parsed.integrations?.length) setIntegrations(parsed.integrations);
        if (parsed.syncLogs?.length) setSyncLogs(parsed.syncLogs);
        if (parsed.notifications?.length) setNotifications(parsed.notifications);
        if (parsed.auditLogs?.length) setAuditLogs(parsed.auditLogs);
      }
    } catch {
      // Fallback to seed data
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          users,
          currentUserId,
          isAuthenticated,
          boats,
          inventory,
          movements,
          restockRequests,
          integrations,
          syncLogs,
          notifications,
          auditLogs,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hydrated,
    users,
    currentUserId,
    isAuthenticated,
    boats,
    inventory,
    movements,
    restockRequests,
    integrations,
    syncLogs,
    notifications,
    auditLogs,
  ]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `tst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || users[0];
  }, [users, currentUserId]);

  const appendAudit = (
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    summary: string
  ) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action,
      entityType,
      entityId,
      summary,
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const appendNotification = (
    notif: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>
  ) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const switchUserById = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (!target.isActive) {
      addToast({
        type: 'error',
        title: 'Account Deactivated',
        description: `${target.fullName} is currently deactivated by an administrator.`,
      });
      return;
    }
    setCurrentUserId(target.id);
    setIsAuthenticated(true);
    addToast({
      type: 'info',
      title: `Switched Active Session: ${target.fullName}`,
      description: `Role: ${target.role} — Permissions & RLS filters updated.`,
    });
  };

  const switchRoleQuick = (role: UserRole) => {
    const firstActiveForRole = users.find((u) => u.role === role && u.isActive);
    if (firstActiveForRole) {
      switchUserById(firstActiveForRole.id);
    }
  };

  const loginAsUser = (emailOrId: string): boolean => {
    const normalized = emailOrId.trim().toLowerCase();
    const found = users.find(
      (u) => u.id.toLowerCase() === normalized || u.email.toLowerCase() === normalized
    );
    if (!found || !found.isActive) {
      addToast({
        type: 'error',
        title: 'Authentication Failed',
        description: found
          ? 'This user account has been deactivated.'
          : 'No active maritime account found for that email.',
      });
      return false;
    }
    setCurrentUserId(found.id);
    setIsAuthenticated(true);
    addToast({
      type: 'success',
      title: `Welcome aboard, ${found.fullName}`,
      description: `Signed in with ${found.role} clearance.`,
    });
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    addToast({
      type: 'info',
      title: 'Signed Out',
      description: 'Your session has been securely terminated.',
    });
  };

  // RBAC-filtered boats
  const accessibleBoats = useMemo(() => {
    const rawAccessible = getAccessibleBoats(currentUser, boats);
    return rawAccessible.map((boat) => {
      const boatItems = inventory.filter((i) => i.boatId === boat.id);
      return computeBoatSummary(boat, boatItems, users);
    });
  }, [currentUser, boats, inventory, users]);

  const accessibleBoatIds = useMemo(() => {
    return new Set(accessibleBoats.map((b) => b.id));
  }, [accessibleBoats]);

  const canAccessBoatId = (boatId: string): boolean => {
    const boat = boats.find((b) => b.id === boatId);
    if (!boat) return false;
    return canUserAccessBoat(currentUser, boat);
  };

  const getBoatById = (boatId: string): ComputedBoatSummary | null => {
    if (!canAccessBoatId(boatId)) return null;
    return accessibleBoats.find((b) => b.id === boatId) || null;
  };

  const accessibleInventory = useMemo(() => {
    return inventory
      .filter((item) => accessibleBoatIds.has(item.boatId))
      .map(enrichInventoryItem);
  }, [inventory, accessibleBoatIds]);

  const getBoatInventory = (boatId: string): ComputedInventoryItem[] => {
    if (!canAccessBoatId(boatId)) return [];
    return accessibleInventory.filter((i) => i.boatId === boatId);
  };

  const accessibleMovements = useMemo(() => {
    return movements.filter((m) => accessibleBoatIds.has(m.boatId));
  }, [movements, accessibleBoatIds]);

  const accessibleRestockRequests = useMemo(() => {
    return restockRequests.filter((r) => accessibleBoatIds.has(r.boatId));
  }, [restockRequests, accessibleBoatIds]);

  const accessibleNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (currentUser.role === 'ADMIN') return true;
      if (n.userId && n.userId === currentUser.id) return true;
      if (n.boatId && accessibleBoatIds.has(n.boatId)) {
        if (currentUser.role === 'OWNER' && n.type === 'SHEET_SYNC_CONFLICT') {
          return false;
        }
        return true;
      }
      return false;
    });
  }, [notifications, currentUser, accessibleBoatIds]);

  // ==================== MUTATIONS ====================

  const createOrUpdateBoat: FleetContextValue['createOrUpdateBoat'] = (payload) => {
    if (currentUser.role !== 'ADMIN') {
      addToast({
        type: 'error',
        title: 'Permission Denied',
        description: 'Only ADMIN users can create or modify boat profiles.',
      });
      return { ok: false, error: 'Only ADMIN users can create or modify boat profiles.' };
    }

    if (!payload.name.trim() || !payload.registrationNumber.trim()) {
      return { ok: false, error: 'Boat name and IMO/registration number are required.' };
    }

    const now = new Date().toISOString();
    if (payload.id) {
      setBoats((prev) =>
        prev.map((b) =>
          b.id === payload.id
            ? {
                ...b,
                ...payload,
                id: b.id,
                updatedAt: now,
              }
            : b
        )
      );
      appendAudit('BOAT_UPDATED', 'BOAT', payload.id, `Updated vessel profile for ${payload.name}`);
      addToast({
        type: 'success',
        title: 'Vessel Updated',
        description: `${payload.name} configuration saved.`,
      });
      return { ok: true, boatId: payload.id };
    } else {
      const newId = `boat-${Date.now()}`;
      const newBoat: Boat = {
        ...payload,
        id: newId,
        createdAt: now,
        updatedAt: now,
      };
      setBoats((prev) => [newBoat, ...prev]);
      appendAudit('BOAT_CREATED', 'BOAT', newId, `Registered new vessel ${payload.name} (${payload.registrationNumber})`);
      addToast({
        type: 'success',
        title: 'Vessel Registered',
        description: `${payload.name} has been added to the fleet.`,
      });
      return { ok: true, boatId: newId };
    }
  };

  const updateBoatMmsi: FleetContextValue['updateBoatMmsi'] = (boatId, mmsi) => {
    if (currentUser.role !== 'ADMIN') {
      return { ok: false, error: 'Only ADMIN users can configure vessel tracking.' };
    }
    const cleaned = mmsi.replace(/\D/g, '');
    if (cleaned && cleaned.length !== 9) {
      return { ok: false, error: 'MMSI must be exactly 9 digits.' };
    }
    const boat = boats.find((b) => b.id === boatId);
    if (!boat) return { ok: false, error: 'Vessel not found.' };

    setBoats((prev) =>
      prev.map((b) =>
        b.id === boatId
          ? { ...b, mmsi: cleaned || undefined, updatedAt: new Date().toISOString() }
          : b
      )
    );
    appendAudit(
      'BOAT_TRACKING_UPDATED',
      'BOAT',
      boatId,
      cleaned
        ? `Linked ${boat.name} to AIS MMSI ${cleaned}`
        : `Removed AIS MMSI link from ${boat.name}`
    );
    addToast({
      type: 'success',
      title: 'Tracking Updated',
      description: cleaned
        ? `${boat.name} is now tracked via MMSI ${cleaned}.`
        : `Live tracking disabled for ${boat.name}.`,
    });
    return { ok: true };
  };

  const createOrUpdateInventoryItem: FleetContextValue['createOrUpdateInventoryItem'] = (payload) => {
    if (currentUser.role !== 'ADMIN') {
      addToast({
        type: 'error',
        title: 'Permission Denied',
        description: 'Only ADMIN users can create or edit required inventory specifications.',
      });
      return { ok: false, error: 'Only ADMIN users can create or edit inventory specifications.' };
    }

    if (!payload.productName.trim() || !payload.sku.trim()) {
      return { ok: false, error: 'Product name and SKU are required.' };
    }
    if (payload.currentQty < 0 || payload.requiredQty < 0 || payload.minWarningQty < 0) {
      return { ok: false, error: 'Quantities cannot be negative.' };
    }

    const now = new Date().toISOString();
    const boat = boats.find((b) => b.id === payload.boatId);

    if (payload.id) {
      const existing = inventory.find((i) => i.id === payload.id);
      setInventory((prev) =>
        prev.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                ...payload,
                id: item.id,
                lastUpdatedAt: now,
                lastUpdatedBy: currentUser.fullName,
              }
            : item
        )
      );

      // If quantity changed during edit, record an ADJUSTED movement
      if (existing && existing.currentQty !== payload.currentQty) {
        const mov: StockMovement = {
          id: `mov-${Date.now()}`,
          boatId: payload.boatId,
          boatName: boat?.name || 'Vessel',
          boatInventoryId: payload.id,
          sku: payload.sku,
          productName: payload.productName,
          categoryName: payload.categoryName,
          unit: payload.unit,
          movementType: 'ADJUSTED',
          previousQty: existing.currentQty,
          newQty: payload.currentQty,
          deltaQty: payload.currentQty - existing.currentQty,
          reason: 'Administrator Specification & Stock Audit Edit',
          performedById: currentUser.id,
          performedByName: currentUser.fullName,
          createdAt: now,
        };
        setMovements((prev) => [mov, ...prev]);
      }

      appendAudit(
        'INVENTORY_SPEC_UPDATED',
        'INVENTORY',
        payload.id,
        `Updated inventory specification for ${payload.productName} (${payload.sku}) on ${boat?.name || payload.boatId}`
      );
      addToast({
        type: 'success',
        title: 'Inventory Item Updated',
        description: `${payload.productName} updated on ${boat?.name}.`,
      });
      return { ok: true };
    } else {
      const newId = `inv-${Date.now()}`;
      const newItem: BoatInventoryItem = {
        ...payload,
        id: newId,
        sheetBaselineQty: payload.currentQty,
        lastUpdatedAt: now,
        lastUpdatedBy: currentUser.fullName,
      };
      setInventory((prev) => [newItem, ...prev]);

      const mov: StockMovement = {
        id: `mov-${Date.now()}`,
        boatId: payload.boatId,
        boatName: boat?.name || 'Vessel',
        boatInventoryId: newId,
        sku: payload.sku,
        productName: payload.productName,
        categoryName: payload.categoryName,
        unit: payload.unit,
        movementType: 'ADDED',
        previousQty: 0,
        newQty: payload.currentQty,
        deltaQty: payload.currentQty,
        reason: 'Initial Inventory Specification Registration',
        performedById: currentUser.id,
        performedByName: currentUser.fullName,
        createdAt: now,
      };
      setMovements((prev) => [mov, ...prev]);

      appendAudit(
        'INVENTORY_ITEM_CREATED',
        'INVENTORY',
        newId,
        `Created ${payload.productName} (${payload.sku}) on ${boat?.name || payload.boatId}`
      );
      addToast({
        type: 'success',
        title: 'Inventory Item Added',
        description: `${payload.productName} registered to ${boat?.name}.`,
      });
      return { ok: true };
    }
  };

  const recordStockMovement: FleetContextValue['recordStockMovement'] = ({
    boatInventoryId,
    movementType,
    quantity,
    reason,
    referenceCode,
  }) => {
    if (currentUser.role === 'OWNER') {
      addToast({
        type: 'error',
        title: 'Permission Denied',
        description: 'Owners can submit restock requests, but only Masters and Admins can record physical stock movements.',
      });
      return { ok: false, error: 'Owners cannot directly modify stock ledgers.' };
    }

    const item = inventory.find((i) => i.id === boatInventoryId);
    if (!item) {
      return { ok: false, error: 'Inventory item not found.' };
    }
    if (!canAccessBoatId(item.boatId)) {
      return { ok: false, error: 'You do not have permission for this vessel.' };
    }
    if (!reason.trim()) {
      return { ok: false, error: 'A movement reason is required for the audit ledger.' };
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return { ok: false, error: 'Please provide a valid positive quantity.' };
    }

    const previousQty = item.currentQty;
    let newQty = previousQty;

    if (movementType === 'ADDED') {
      newQty = previousQty + quantity;
    } else if (movementType === 'REMOVED' || movementType === 'TRANSFERRED') {
      if (quantity > previousQty) {
        return {
          ok: false,
          error: `Cannot remove/transfer ${quantity} ${item.unit}; only ${previousQty} ${item.unit} currently in stock.`,
        };
      }
      newQty = previousQty - quantity;
    } else if (movementType === 'ADJUSTED') {
      newQty = quantity;
    }

    const deltaQty = newQty - previousQty;
    const now = new Date().toISOString();
    const boat = boats.find((b) => b.id === item.boatId);

    setInventory((prev) =>
      prev.map((inv) =>
        inv.id === item.id
          ? {
              ...inv,
              currentQty: newQty,
              lastUpdatedAt: now,
              lastUpdatedBy: currentUser.fullName,
            }
          : inv
      )
    );

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      boatId: item.boatId,
      boatName: boat?.name || 'Vessel',
      boatInventoryId: item.id,
      sku: item.sku,
      productName: item.productName,
      categoryName: item.categoryName,
      unit: item.unit,
      movementType,
      previousQty,
      newQty,
      deltaQty,
      reason: reason.trim(),
      referenceCode: referenceCode?.trim() || undefined,
      performedById: currentUser.id,
      performedByName: currentUser.fullName,
      createdAt: now,
    };

    setMovements((prev) => [newMovement, ...prev]);

    // Check if stock fell below required specification and emit notification
    if (newQty < item.requiredQty) {
      const missing = Math.max(item.requiredQty - newQty, 0);
      const isCrit = newQty === 0 || newQty / item.requiredQty < 0.45;
      appendNotification({
        boatId: item.boatId,
        boatName: boat?.name,
        type: isCrit ? 'CRITICAL_SHORTAGE' : 'LOW_STOCK',
        severity: isCrit ? 'CRITICAL' : 'WARNING',
        title: `${isCrit ? 'Critical Shortage' : 'Below Specification'}: ${item.productName}`,
        message: `${boat?.name}: ${item.productName} is now ${newQty} / ${item.requiredQty} ${item.unit} (${missing} missing).`,
        actionUrl: `/dashboard/boats/${item.boatId}`,
      });
    }

    appendAudit(
      `STOCK_${movementType}`,
      'INVENTORY',
      item.id,
      `${movementType} on ${boat?.name}: ${item.productName} (${previousQty} → ${newQty} ${item.unit}) — ${reason}`
    );

    addToast({
      type: 'success',
      title: 'Stock Movement Recorded',
      description: `${item.productName}: ${previousQty} → ${newQty} ${item.unit} (${deltaQty >= 0 ? '+' : ''}${deltaQty})`,
    });

    return { ok: true };
  };

  const submitRestockRequest: FleetContextValue['submitRestockRequest'] = ({
    boatInventoryId,
    requestedQty,
    priority,
    reason,
  }) => {
    const item = inventory.find((i) => i.id === boatInventoryId);
    if (!item) return { ok: false, error: 'Inventory item not found.' };
    if (!canAccessBoatId(item.boatId)) {
      return { ok: false, error: 'Unauthorized vessel access.' };
    }
    if (requestedQty <= 0) {
      return { ok: false, error: 'Requested quantity must be greater than zero.' };
    }
    if (!reason.trim()) {
      return { ok: false, error: 'Please provide a reason for the restock request.' };
    }

    const boat = boats.find((b) => b.id === item.boatId);
    const code = `RST-2026-${Math.floor(100 + Math.random() * 899)}`;
    const now = new Date().toISOString();

    const newReq: RestockRequest = {
      id: `req-${Date.now()}`,
      requestCode: code,
      boatId: item.boatId,
      boatName: boat?.name || 'Vessel',
      boatInventoryId: item.id,
      sku: item.sku,
      productName: item.productName,
      categoryName: item.categoryName,
      unit: item.unit,
      currentQtySnapshot: item.currentQty,
      requiredQtySnapshot: item.requiredQty,
      requestedQty,
      reason: reason.trim(),
      priority,
      status: 'PENDING',
      requestedById: currentUser.id,
      requestedByName: currentUser.fullName,
      createdAt: now,
    };

    setRestockRequests((prev) => [newReq, ...prev]);

    appendNotification({
      boatId: item.boatId,
      boatName: boat?.name,
      type: 'RESTOCK_NEW',
      severity: priority === 'URGENT' ? 'WARNING' : 'INFO',
      title: `New Restock Request (${code})`,
      message: `${currentUser.fullName} requested ${requestedQty} ${item.unit} of ${item.productName} for ${boat?.name}.`,
      actionUrl: '/dashboard/restock',
    });

    appendAudit(
      'RESTOCK_REQUEST_SUBMITTED',
      'RESTOCK',
      newReq.id,
      `Submitted restock request ${code} for ${requestedQty} ${item.unit} of ${item.productName} on ${boat?.name}`
    );

    addToast({
      type: 'success',
      title: `Restock Request ${code} Submitted`,
      description: `Sent to Fleet Master for review (${requestedQty} ${item.unit} of ${item.productName}).`,
    });

    return { ok: true };
  };

  const reviewRestockRequest: FleetContextValue['reviewRestockRequest'] = ({
    requestId,
    decision,
    comment,
  }) => {
    if (currentUser.role === 'OWNER') {
      addToast({
        type: 'error',
        title: 'Permission Denied',
        description: 'Owners cannot approve or reject restock requests.',
      });
      return { ok: false, error: 'Owners cannot approve or reject restock requests.' };
    }

    const req = restockRequests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: 'Restock request not found.' };
    if (!canAccessBoatId(req.boatId)) {
      return { ok: false, error: 'You are not assigned to this vessel.' };
    }

    const now = new Date().toISOString();
    setRestockRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: decision,
              reviewerId: currentUser.id,
              reviewerName: currentUser.fullName,
              reviewComment:
                comment.trim() ||
                (decision === 'APPROVED'
                  ? 'Approved by Fleet Master. Awaiting physical delivery onboard.'
                  : 'Rejected during fleet review.'),
              reviewedAt: now,
            }
          : r
      )
    );

    appendNotification({
      boatId: req.boatId,
      boatName: req.boatName,
      userId: req.requestedById,
      type: 'RESTOCK_DECISION',
      severity: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      title: `Restock Request ${req.requestCode} ${decision}`,
      message: `${currentUser.fullName} ${decision.toLowerCase()} ${req.requestedQty} ${req.unit} of ${req.productName} for ${req.boatName}. Note: Stock updates when goods are physically received.`,
      actionUrl: '/dashboard/restock',
    });

    appendAudit(
      `RESTOCK_REQUEST_${decision}`,
      'RESTOCK',
      req.id,
      `${decision} restock request ${req.requestCode} (${req.productName} on ${req.boatName})`
    );

    addToast({
      type: decision === 'APPROVED' ? 'success' : 'info',
      title: `Request ${req.requestCode} ${decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
      description:
        decision === 'APPROVED'
          ? 'Approved for procurement. Stock quantity will update once goods are recorded as received.'
          : 'Request status updated to Rejected.',
    });

    return { ok: true };
  };

  const recordGoodsReceived: FleetContextValue['recordGoodsReceived'] = (requestId) => {
    if (currentUser.role === 'OWNER') {
      return { ok: false, error: 'Only Masters and Admins can record goods received into stock.' };
    }

    const req = restockRequests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: 'Restock request not found.' };
    if (req.status !== 'APPROVED') {
      return { ok: false, error: 'Only APPROVED requests can be fulfilled into stock.' };
    }

    const item = inventory.find((i) => i.id === req.boatInventoryId);
    if (!item) return { ok: false, error: 'Associated inventory item not found.' };

    const now = new Date().toISOString();
    const prevQty = item.currentQty;
    const newQty = prevQty + req.requestedQty;

    setInventory((prev) =>
      prev.map((inv) =>
        inv.id === item.id
          ? {
              ...inv,
              currentQty: newQty,
              lastUpdatedAt: now,
              lastUpdatedBy: currentUser.fullName,
            }
          : inv
      )
    );

    setRestockRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'FULFILLED',
              fulfilledAt: now,
            }
          : r
      )
    );

    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      boatId: req.boatId,
      boatName: req.boatName,
      boatInventoryId: item.id,
      sku: item.sku,
      productName: item.productName,
      categoryName: item.categoryName,
      unit: item.unit,
      movementType: 'ADDED',
      previousQty: prevQty,
      newQty,
      deltaQty: req.requestedQty,
      reason: `Goods Received & Verified Onboard (${req.requestCode})`,
      referenceCode: req.requestCode,
      performedById: currentUser.id,
      performedByName: currentUser.fullName,
      createdAt: now,
    };

    setMovements((prev) => [newMov, ...prev]);

    appendAudit(
      'RESTOCK_GOODS_RECEIVED',
      'RESTOCK',
      req.id,
      `Recorded delivery of ${req.requestedQty} ${req.unit} ${req.productName} for ${req.boatName} (${req.requestCode}). Stock: ${prevQty} → ${newQty}`
    );

    addToast({
      type: 'success',
      title: 'Goods Received & Stock Updated',
      description: `${req.productName} on ${req.boatName} increased from ${prevQty} to ${newQty} ${req.unit}.`,
    });

    return { ok: true };
  };

  const createOrUpdateUser: FleetContextValue['createOrUpdateUser'] = (payload) => {
    if (currentUser.role !== 'ADMIN') {
      return { ok: false, error: 'Only ADMIN users can create or edit user accounts.' };
    }
    if (!payload.fullName.trim() || !payload.email.trim()) {
      return { ok: false, error: 'Full name and email address are required.' };
    }

    const now = new Date().toISOString();
    if (payload.id) {
      setUsers((prev) =>
        prev.map((u) => (u.id === payload.id ? { ...u, ...payload, id: u.id } : u))
      );
      appendAudit('USER_UPDATED', 'USER', payload.id, `Updated user profile & role (${payload.role}) for ${payload.fullName}`);
      addToast({
        type: 'success',
        title: 'User Profile Updated',
        description: `${payload.fullName} (${payload.role}) saved.`,
      });
      return { ok: true };
    } else {
      const newId = `usr-${Date.now()}`;
      const newUser: UserProfile = {
        ...payload,
        id: newId,
        createdAt: now,
      };
      setUsers((prev) => [...prev, newUser]);
      appendAudit('USER_CREATED', 'USER', newId, `Created new ${payload.role} account for ${payload.fullName}`);
      addToast({
        type: 'success',
        title: 'User Created',
        description: `${payload.fullName} added with ${payload.role} permissions.`,
      });
      return { ok: true };
    }
  };

  const toggleUserActive: FleetContextValue['toggleUserActive'] = (userId) => {
    if (currentUser.role !== 'ADMIN') {
      return { ok: false, error: 'Only ADMIN users can deactivate or reactivate users.' };
    }
    if (userId === currentUser.id) {
      return { ok: false, error: 'You cannot deactivate your own active administrator account.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'User not found.' };

    const nextState = !target.isActive;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: nextState } : u))
    );
    appendAudit(
      nextState ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      'USER',
      userId,
      `${nextState ? 'Reactivated' : 'Deactivated'} user account ${target.fullName}`
    );
    addToast({
      type: 'info',
      title: nextState ? 'User Reactivated' : 'User Deactivated',
      description: `${target.fullName} is now ${nextState ? 'active' : 'deactivated'}.`,
    });
    return { ok: true };
  };

  const saveSheetIntegration: FleetContextValue['saveSheetIntegration'] = (payload) => {
    if (currentUser.role !== 'ADMIN') {
      return { ok: false, error: 'Only ADMIN users can configure Google Sheets integrations.' };
    }

    const boat = boats.find((b) => b.id === payload.boatId);
    if (!boat) return { ok: false, error: 'Boat not found.' };

    const existing = integrations.find((i) => i.boatId === payload.boatId || i.id === payload.id);
    if (existing) {
      setIntegrations((prev) =>
        prev.map((intg) =>
          intg.id === existing.id
            ? {
                ...intg,
                boatId: payload.boatId,
                boatName: boat.name,
                spreadsheetId: payload.spreadsheetId,
                spreadsheetName: payload.spreadsheetName,
                worksheetName: payload.worksheetName,
                columnMapping: payload.columnMapping,
                syncDirection: payload.syncDirection,
              }
            : intg
        )
      );
    } else {
      const newIntg: GoogleSheetIntegration = {
        id: `int-${Date.now()}`,
        boatId: payload.boatId,
        boatName: boat.name,
        spreadsheetId: payload.spreadsheetId,
        spreadsheetName: payload.spreadsheetName,
        worksheetName: payload.worksheetName,
        columnMapping: payload.columnMapping,
        syncDirection: payload.syncDirection,
        status: 'CONNECTED',
        isDemoMode: true,
        lastSyncedAt: new Date().toISOString(),
        lastSyncSummary: 'Integration configured and ready for sync.',
        pendingConflictsCount: 0,
      };
      setIntegrations((prev) => [...prev, newIntg]);
    }

    setBoats((prev) =>
      prev.map((b) =>
        b.id === payload.boatId
          ? {
              ...b,
              googleSheetId: payload.spreadsheetId,
              googleWorksheetName: payload.worksheetName,
            }
          : b
      )
    );

    appendAudit(
      'GOOGLE_SHEET_CONFIGURED',
      'GOOGLE_SHEETS',
      payload.boatId,
      `Configured Google Sheet (${payload.spreadsheetName} / ${payload.worksheetName}) for ${boat.name}`
    );

    addToast({
      type: 'success',
      title: 'Google Sheets Configuration Saved',
      description: `Connected ${payload.worksheetName} to ${boat.name}.`,
    });

    return { ok: true };
  };

  const executeSheetSync: FleetContextValue['executeSheetSync'] = ({
    integrationId,
    direction,
    conflictResolution = {},
  }) => {
    if (currentUser.role !== 'ADMIN') {
      return {
        ok: false,
        message: 'Only ADMIN users can trigger Google Sheets synchronization.',
        conflictsCount: 0,
      };
    }

    const intg = integrations.find((i) => i.id === integrationId);
    if (!intg) {
      return { ok: false, message: 'Integration not found.', conflictsCount: 0 };
    }

    const boatItems = inventory.filter((i) => i.boatId === intg.boatId);
    const now = new Date().toISOString();
    let updatedCount = 0;
    let unresolvedConflicts = 0;

    const nextInventory = inventory.map((item) => {
      if (item.boatId !== intg.boatId) return item;

      // Check simulated sheet value for Sovereign ENG-OIL-15W40 or Aurelia PRV-CHM-DOM
      let sheetQty = item.currentQty;
      const baseline = item.sheetBaselineQty ?? item.currentQty;

      if (item.sku === 'ENG-OIL-15W40' && item.boatId === 'boat-sovereign') {
        sheetQty = baseline === item.currentQty ? item.currentQty : 7;
      } else if (item.sku === 'PRV-CHM-DOM' && item.boatId === 'boat-aurelia') {
        sheetQty = 18;
      }

      const isConflict =
        item.currentQty !== baseline &&
        sheetQty !== baseline &&
        item.currentQty !== sheetQty;

      if (isConflict) {
        const choice = conflictResolution[item.sku];
        if (!choice) {
          unresolvedConflicts += 1;
          return item;
        }
        const resolvedQty = choice === 'USE_SHEET' ? sheetQty : item.currentQty;
        updatedCount += 1;
        return {
          ...item,
          currentQty: resolvedQty,
          sheetBaselineQty: resolvedQty,
          lastUpdatedAt: now,
          lastUpdatedBy: `${currentUser.fullName} (Sheets Sync)`,
        };
      }

      if (direction === 'IMPORT' || direction === 'BIDIRECTIONAL') {
        if (sheetQty !== baseline && item.currentQty === baseline) {
          updatedCount += 1;
          return {
            ...item,
            currentQty: sheetQty,
            sheetBaselineQty: sheetQty,
            lastUpdatedAt: now,
            lastUpdatedBy: 'Google Sheets Import',
          };
        }
      }

      if (direction === 'EXPORT' || direction === 'BIDIRECTIONAL') {
        if (item.currentQty !== baseline) {
          updatedCount += 1;
          return {
            ...item,
            sheetBaselineQty: item.currentQty,
          };
        }
      }

      return item;
    });

    setInventory(nextInventory);

    const nextStatus = unresolvedConflicts > 0 ? 'CONFLICT' : 'CONNECTED';
    const summaryText =
      unresolvedConflicts > 0
        ? `${boatItems.length} rows scanned • ${updatedCount} synced • ${unresolvedConflicts} conflict(s) held for review`
        : `${boatItems.length} rows synchronized cleanly (${updatedCount} updated)`;

    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === integrationId
          ? {
              ...i,
              status: nextStatus,
              lastSyncedAt: now,
              lastSyncSummary: summaryText,
              pendingConflictsCount: unresolvedConflicts,
            }
          : i
      )
    );

    const newSyncLog: SyncLog = {
      id: `slog-${Date.now()}`,
      integrationId: intg.id,
      boatId: intg.boatId,
      boatName: intg.boatName,
      direction,
      status: unresolvedConflicts > 0 ? 'PARTIAL_CONFLICT' : 'SUCCESS',
      recordsProcessed: boatItems.length,
      recordsUpdated: updatedCount,
      conflictsDetected: unresolvedConflicts,
      errorMessage:
        unresolvedConflicts > 0
          ? `${unresolvedConflicts} item(s) had simultaneous edits in App and Sheet. Select resolution strategy to commit.`
          : undefined,
      initiatedByName: currentUser.fullName,
      isDemoMode: intg.isDemoMode,
      createdAt: now,
    };

    setSyncLogs((prev) => [newSyncLog, ...prev]);

    appendAudit(
      'GOOGLE_SHEET_SYNC_RUN',
      'GOOGLE_SHEETS',
      intg.id,
      `Ran ${direction} sync for ${intg.boatName}: ${summaryText}`
    );

    addToast({
      type: unresolvedConflicts > 0 ? 'warning' : 'success',
      title:
        unresolvedConflicts > 0
          ? 'Sync Completed with Conflict Hold'
          : 'Google Sheets Synchronization Complete',
      description: summaryText,
    });

    return {
      ok: true,
      message: summaryText,
      conflictsCount: unresolvedConflicts,
    };
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    addToast({
      type: 'info',
      title: 'Notifications Cleared',
      description: 'All visible notifications marked as read.',
    });
  };

  const resetDemoState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsers(SEED_USERS);
    setCurrentUserId('usr-admin-1');
    setIsAuthenticated(true);
    setBoats(SEED_BOATS);
    setInventory(SEED_INVENTORY);
    setMovements(SEED_STOCK_MOVEMENTS);
    setRestockRequests(SEED_RESTOCK_REQUESTS);
    setIntegrations(SEED_INTEGRATIONS);
    setSyncLogs(SEED_SYNC_LOGS);
    setNotifications(SEED_NOTIFICATIONS);
    setAuditLogs(SEED_AUDIT_LOGS);
    addToast({
      type: 'success',
      title: 'Demo State Reset',
      description: 'Restored initial maritime seed data across all vessels.',
    });
  };

  return (
    <FleetContext.Provider
      value={{
        currentUser,
        users,
        switchUserById,
        switchRoleQuick,
        logout,
        isAuthenticated,
        loginAsUser,
        accessibleBoats,
        accessibleInventory,
        accessibleMovements,
        accessibleRestockRequests,
        accessibleNotifications,
        categories,
        integrations,
        syncLogs,
        auditLogs,
        canAccessBoatId,
        getBoatById,
        getBoatInventory,
        createOrUpdateBoat,
        updateBoatMmsi,
        createOrUpdateInventoryItem,
        recordStockMovement,
        submitRestockRequest,
        reviewRestockRequest,
        recordGoodsReceived,
        createOrUpdateUser,
        toggleUserActive,
        saveSheetIntegration,
        executeSheetSync,
        markNotificationRead,
        markAllNotificationsRead,
        toasts,
        addToast,
        dismissToast,
        resetDemoState,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return ctx;
}
