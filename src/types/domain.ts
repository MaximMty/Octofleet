export type UserRole = 'ADMIN' | 'MASTER' | 'OWNER';

export type ComplianceStatus = 'MEETS_SPEC' | 'ATTENTION' | 'CRITICAL';

export type MovementType = 'ADDED' | 'REMOVED' | 'ADJUSTED' | 'TRANSFERRED';

export type RestockStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

export type SyncStatus = 'CONNECTED' | 'SYNCING' | 'CONFLICT' | 'ERROR' | 'DISCONNECTED';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  title: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface BoatMember {
  id: string;
  boatId: string;
  userId: string;
  memberRole: UserRole;
  isPrimary: boolean;
}

export interface Boat {
  id: string;
  name: string;
  registrationNumber: string;
  vesselClass: string;
  lengthMeters: number;
  homePort: string;
  imageUrl?: string;
  ownerId: string;
  masterId: string;
  additionalOwnerIds?: string[];
  description: string;
  specificationTier: string;
  googleSheetId?: string;
  googleWorksheetName?: string;
  /** 9-digit Maritime Mobile Service Identity — used for live AIS tracking (MarineTraffic). */
  mmsi?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  sortOrder: number;
}

export interface BoatInventoryItem {
  id: string;
  boatId: string;
  sku: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  unit: string;
  currentQty: number;
  requiredQty: number;
  minWarningQty: number;
  maxQty?: number;
  sheetRowIndex?: number;
  sheetBaselineQty?: number;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface ComputedInventoryItem extends BoatInventoryItem {
  missingQty: number;
  complianceRatio: number; // 0 to 100
  status: ComplianceStatus;
}

export interface ComputedBoatSummary extends Boat {
  ownerName: string;
  masterName: string;
  totalItems: number;
  compliantItemsCount: number;
  lowStockItemsCount: number;
  criticalItemsCount: number;
  compliancePercentage: number;
  overallStatus: ComplianceStatus;
  lastInventoryUpdate: string;
}

export interface StockMovement {
  id: string;
  boatId: string;
  boatName: string;
  boatInventoryId: string;
  sku: string;
  productName: string;
  categoryName: string;
  unit: string;
  movementType: MovementType;
  previousQty: number;
  newQty: number;
  deltaQty: number;
  reason: string;
  referenceCode?: string;
  performedById: string;
  performedByName: string;
  createdAt: string;
}

export interface RestockRequest {
  id: string;
  requestCode: string;
  boatId: string;
  boatName: string;
  boatInventoryId: string;
  sku: string;
  productName: string;
  categoryName: string;
  unit: string;
  currentQtySnapshot: number;
  requiredQtySnapshot: number;
  requestedQty: number;
  reason: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: RestockStatus;
  requestedById: string;
  requestedByName: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewComment?: string;
  reviewedAt?: string;
  fulfilledAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId?: string;
  targetRole?: UserRole;
  boatId?: string;
  boatName?: string;
  type: 'LOW_STOCK' | 'CRITICAL_SHORTAGE' | 'RESTOCK_NEW' | 'RESTOCK_DECISION' | 'SHEET_SYNC_ERROR' | 'SHEET_SYNC_CONFLICT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: 'BOAT' | 'INVENTORY' | 'RESTOCK' | 'USER' | 'GOOGLE_SHEETS' | 'SETTINGS';
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface ColumnMapping {
  sku: string;
  productName: string;
  category: string;
  currentQty: string;
  requiredQty: string;
  unit: string;
  lastUpdated: string;
}

export interface SheetRowPreview {
  rowNumber: number;
  sku: string;
  productName: string;
  category: string;
  sheetQty: number | string;
  sheetRequiredQty: number | string;
  unit: string;
  appCurrentQty?: number;
  baselineQty?: number;
  validationStatus: 'VALID' | 'CONFLICT' | 'INVALID' | 'NEW_ITEM';
  validationMessage?: string;
}

export interface GoogleSheetIntegration {
  id: string;
  boatId: string;
  boatName: string;
  spreadsheetId: string;
  spreadsheetName: string;
  worksheetName: string;
  columnMapping: ColumnMapping;
  syncDirection: 'BIDIRECTIONAL' | 'IMPORT_ONLY' | 'EXPORT_ONLY';
  status: SyncStatus;
  isDemoMode: boolean;
  lastSyncedAt?: string;
  lastSyncSummary?: string;
  pendingConflictsCount: number;
}

export interface SyncLog {
  id: string;
  integrationId: string;
  boatId: string;
  boatName: string;
  direction: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL';
  status: 'SUCCESS' | 'PARTIAL_CONFLICT' | 'FAILED';
  recordsProcessed: number;
  recordsUpdated: number;
  conflictsDetected: number;
  errorMessage?: string;
  initiatedByName: string;
  isDemoMode: boolean;
  createdAt: string;
}
