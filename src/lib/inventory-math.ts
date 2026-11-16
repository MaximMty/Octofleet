import {
  Boat,
  BoatInventoryItem,
  ComplianceStatus,
  ComputedBoatSummary,
  ComputedInventoryItem,
  UserProfile,
} from '@/types/domain';

/**
 * Formula specified by requirements:
 * Missing quantity = MAX(Required quantity - Current quantity, 0)
 */
export function calculateMissingQuantity(requiredQty: number, currentQty: number): number {
  const safeReq = Number.isFinite(requiredQty) ? Math.max(0, requiredQty) : 0;
  const safeCur = Number.isFinite(currentQty) ? Math.max(0, currentQty) : 0;
  return Math.max(safeReq - safeCur, 0);
}

/**
 * Calculates compliance ratio (0-100) for a single inventory item.
 * Handles zero-stock requirements safely (if required <= 0, item is 100% compliant).
 */
export function calculateItemComplianceRatio(requiredQty: number, currentQty: number): number {
  if (!Number.isFinite(requiredQty) || requiredQty <= 0) {
    return 100;
  }
  const safeCur = Number.isFinite(currentQty) ? Math.max(0, currentQty) : 0;
  const ratio = Math.min(safeCur / requiredQty, 1) * 100;
  return Math.round(ratio * 10) / 10;
}

/**
 * Determines visual & operational status of a single inventory item:
 * - MEETS_SPEC (Green): Current >= Required
 * - CRITICAL (Red): Current === 0 (when Required > 0) OR Current <= minWarningQty * 0.5 OR Current < Required * 0.4
 * - ATTENTION (Amber): Current < Required (low stock / below specification)
 */
export function calculateItemStatus(
  currentQty: number,
  requiredQty: number,
  minWarningQty: number
): ComplianceStatus {
  if (requiredQty <= 0) {
    return 'MEETS_SPEC';
  }
  if (currentQty >= requiredQty) {
    return 'MEETS_SPEC';
  }
  if (
    currentQty <= 0 ||
    currentQty <= Math.floor(minWarningQty * 0.5) ||
    currentQty / requiredQty < 0.45
  ) {
    return 'CRITICAL';
  }
  return 'ATTENTION';
}

export function enrichInventoryItem(item: BoatInventoryItem): ComputedInventoryItem {
  const missingQty = calculateMissingQuantity(item.requiredQty, item.currentQty);
  const complianceRatio = calculateItemComplianceRatio(item.requiredQty, item.currentQty);
  const status = calculateItemStatus(item.currentQty, item.requiredQty, item.minWarningQty);

  return {
    ...item,
    missingQty,
    complianceRatio,
    status,
  };
}

/**
 * Calculates overall compliance percentage across a list of inventory items.
 * Uses weighted compliance across applicable items (where requiredQty > 0),
 * capping each item's contribution at its requiredQty so surplus stock on one item
 * cannot mask shortages on another item.
 * Safely handles empty inventories and zero-requirement inventories.
 */
export function calculateFleetOrBoatCompliance(items: BoatInventoryItem[]): number {
  if (!items || items.length === 0) {
    return 100;
  }

  const applicableItems = items.filter((item) => item.requiredQty > 0);
  if (applicableItems.length === 0) {
    return 100;
  }

  let totalRequiredUnits = 0;
  let totalFulfilledUnits = 0;

  for (const item of applicableItems) {
    const req = Math.max(0, item.requiredQty);
    const cur = Math.max(0, item.currentQty);
    totalRequiredUnits += req;
    totalFulfilledUnits += Math.min(cur, req);
  }

  if (totalRequiredUnits === 0) {
    return 100;
  }

  return Math.round((totalFulfilledUnits / totalRequiredUnits) * 100);
}

/**
 * Computes a complete summary for a single boat based on its inventory items.
 */
export function computeBoatSummary(
  boat: Boat,
  boatItems: BoatInventoryItem[],
  users: UserProfile[]
): ComputedBoatSummary {
  const computedItems = boatItems.map(enrichInventoryItem);
  const owner = users.find((u) => u.id === boat.ownerId);
  const master = users.find((u) => u.id === boat.masterId);

  const totalItems = computedItems.length;
  const compliantItemsCount = computedItems.filter((i) => i.status === 'MEETS_SPEC').length;
  const lowStockItemsCount = computedItems.filter((i) => i.status !== 'MEETS_SPEC').length;
  const criticalItemsCount = computedItems.filter((i) => i.status === 'CRITICAL').length;
  const compliancePercentage = calculateFleetOrBoatCompliance(boatItems);

  let overallStatus: ComplianceStatus = 'MEETS_SPEC';
  if (criticalItemsCount > 0 || compliancePercentage < 70) {
    overallStatus = 'CRITICAL';
  } else if (lowStockItemsCount > 0 || compliancePercentage < 100) {
    overallStatus = 'ATTENTION';
  }

  const latestTimestamp = computedItems.reduce((latest, item) => {
    return item.lastUpdatedAt > latest ? item.lastUpdatedAt : latest;
  }, boat.updatedAt);

  return {
    ...boat,
    ownerName: owner ? owner.fullName : 'Unassigned Owner',
    masterName: master ? master.fullName : 'Unassigned Master',
    totalItems,
    compliantItemsCount,
    lowStockItemsCount,
    criticalItemsCount,
    compliancePercentage,
    overallStatus,
    lastInventoryUpdate: latestTimestamp,
  };
}

/**
 * Strict RBAC helper: checks whether a user is authorized to access a given boat.
 * - ADMIN: Full access to all boats
 * - MASTER: Access to all assigned boats (where masterId === user.id)
 * - OWNER: Strictly restricted to boats where ownerId === user.id or additionalOwnerIds includes user.id
 */
export function canUserAccessBoat(user: UserProfile | null | undefined, boat: Boat): boolean {
  if (!user || !user.isActive) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'MASTER') {
    return boat.masterId === user.id;
  }
  if (user.role === 'OWNER') {
    return (
      boat.ownerId === user.id ||
      Boolean(boat.additionalOwnerIds && boat.additionalOwnerIds.includes(user.id))
    );
  }
  return false;
}

export function getAccessibleBoats(user: UserProfile | null | undefined, boats: Boat[]): Boat[] {
  if (!user || !user.isActive) return [];
  return boats.filter((boat) => canUserAccessBoat(user, boat));
}
