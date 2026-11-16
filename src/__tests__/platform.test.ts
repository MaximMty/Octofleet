import { describe, expect, it } from 'vitest';
import {
  calculateFleetOrBoatCompliance,
  calculateItemComplianceRatio,
  calculateItemStatus,
  calculateMissingQuantity,
  canUserAccessBoat,
  getAccessibleBoats,
} from '../lib/inventory-math';
import {
  buildSheetPreviewRows,
  validateColumnMapping,
} from '../lib/google-sheets-service';
import { SEED_BOATS, SEED_INVENTORY, SEED_USERS } from '../lib/seed-data';

describe('OctoFleet Inventory Calculation Engine', () => {
  it('calculates Missing Quantity = MAX(Required - Current, 0) accurately', () => {
    // Bottled Water: 24 / 50 units -> 26 missing
    expect(calculateMissingQuantity(50, 24)).toBe(26);
    // Engine Oil: 4 / 10 units -> 6 missing
    expect(calculateMissingQuantity(10, 4)).toBe(6);
    // Towels: 35 / 30 units -> 0 missing (Meets requirements)
    expect(calculateMissingQuantity(30, 35)).toBe(0);
    // Zero-stock requirement edge case
    expect(calculateMissingQuantity(0, 0)).toBe(0);
  });

  it('handles zero-stock requirements and empty inventories safely in compliance %', () => {
    expect(calculateFleetOrBoatCompliance([])).toBe(100);
    expect(calculateItemComplianceRatio(0, 0)).toBe(100);
    expect(calculateItemStatus(0, 0, 0)).toBe('MEETS_SPEC');
  });

  it('caps surplus stock at required quantity so surplus on Towels does not mask shortages on Water/Oil', () => {
    const sovereignItems = SEED_INVENTORY.filter((i) => i.boatId === 'boat-sovereign');
    const compliance = calculateFleetOrBoatCompliance(sovereignItems);
    // Required total: 50 + 10 + 30 + 12 + 12 + 8 = 122
    // Fulfilled (capped): 24 + 4 + 30 + 12 + 12 + 8 = 90
    // 90 / 122 = 73.77% -> 74%
    expect(compliance).toBe(74);
  });
});

describe('OctoFleet RBAC & Strict Owner Boat Isolation', () => {
  const admin = SEED_USERS.find((u) => u.id === 'usr-admin-1')!;
  const masterMed = SEED_USERS.find((u) => u.id === 'usr-master-1')!;
  const ownerSterling = SEED_USERS.find((u) => u.id === 'usr-owner-1')!;
  const ownerRossi = SEED_USERS.find((u) => u.id === 'usr-owner-2')!;

  const sovereign = SEED_BOATS.find((b) => b.id === 'boat-sovereign')!;
  const aurelia = SEED_BOATS.find((b) => b.id === 'boat-aurelia')!;
  const borealis = SEED_BOATS.find((b) => b.id === 'boat-borealis')!;

  it('grants ADMIN access to all fleet boats', () => {
    expect(getAccessibleBoats(admin, SEED_BOATS).length).toBe(5);
  });

  it('restricts MASTER to their assigned fleet vessels', () => {
    expect(canUserAccessBoat(masterMed, sovereign)).toBe(true);
    expect(canUserAccessBoat(masterMed, aurelia)).toBe(true);
    expect(canUserAccessBoat(masterMed, borealis)).toBe(false);
  });

  it('strictly isolates OWNER to their own boats and blocks access to other owners boats', () => {
    // Alistair Sterling owns M/Y Sovereign and S/Y Solaris, NOT M/Y Aurelia
    expect(canUserAccessBoat(ownerSterling, sovereign)).toBe(true);
    expect(canUserAccessBoat(ownerSterling, aurelia)).toBe(false);
    expect(canUserAccessBoat(ownerSterling, borealis)).toBe(false);

    // Sofia Rossi owns M/Y Aurelia, NOT M/Y Sovereign
    expect(canUserAccessBoat(ownerRossi, aurelia)).toBe(true);
    expect(canUserAccessBoat(ownerRossi, sovereign)).toBe(false);
  });

  it('blocks deactivated users from accessing any boat', () => {
    const deactivatedOwner = { ...ownerSterling, isActive: false };
    expect(canUserAccessBoat(deactivatedOwner, sovereign)).toBe(false);
  });
});

describe('Google Sheets Synchronization & Conflict Detection Engine', () => {
  it('validates spreadsheet column mappings and rejects duplicate or invalid columns', () => {
    const valid = validateColumnMapping({
      sku: 'A',
      productName: 'B',
      category: 'C',
      currentQty: 'D',
      requiredQty: 'E',
      unit: 'F',
      lastUpdated: 'G',
    });
    expect(valid.valid).toBe(true);

    const duplicate = validateColumnMapping({
      sku: 'A',
      productName: 'A',
      category: 'C',
      currentQty: 'D',
      requiredQty: 'E',
      unit: 'F',
      lastUpdated: 'G',
    });
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors.length).toBeGreaterThan(0);
  });

  it('detects bidirectional conflicts when both App and Sheet diverge from baseline', () => {
    const sovereignItems = SEED_INVENTORY.filter((i) => i.boatId === 'boat-sovereign');
    const preview = buildSheetPreviewRows('boat-sovereign', sovereignItems, true);

    const oilRow = preview.find((r) => r.sku === 'ENG-OIL-15W40');
    expect(oilRow).toBeDefined();
    expect(oilRow?.validationStatus).toBe('CONFLICT');

    const invalidRow = preview.find((r) => r.validationStatus === 'INVALID');
    expect(invalidRow).toBeDefined();
  });
});
