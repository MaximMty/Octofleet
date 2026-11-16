import {
  BoatInventoryItem,
  ColumnMapping,
  SheetRowPreview,
} from '@/types/domain';

export function isGoogleCredentialsConfigured(): boolean {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key = process.env.GOOGLE_PRIVATE_KEY || '';
  return Boolean(
    email &&
      key &&
      !email.includes('your-gcp-project') &&
      !key.includes('YOUR_PRIVATE_KEY_HERE')
  );
}

/**
 * Generates realistic external worksheet rows for preview & conflict detection
 * when running in Demo Mode, or parses fetched Google Sheets rows when live credentials exist.
 *
 * Includes:
 * - Cleanly matching rows
 * - Remote Sheet update ready to import (e.g. PRV-WTR-750 updated in sheet or app)
 * - Bi-directional conflict (ENG-OIL-15W40 where baseline was 6, App is 4, and Sheet was edited to 7)
 * - New item row in sheet not yet in boat inventory
 * - Invalid row example (when includeValidationSample is enabled)
 */
export function buildSheetPreviewRows(
  boatId: string,
  boatInventory: BoatInventoryItem[],
  includeInvalidSample = false
): SheetRowPreview[] {
  const rows: SheetRowPreview[] = boatInventory.map((item, idx) => {
    const rowNumber = item.sheetRowIndex || idx + 2;
    const baseline = item.sheetBaselineQty ?? item.currentQty;

    // Simulate a realistic external edit on ENG-OIL-15W40 on M/Y Sovereign to demonstrate conflict detection
    let simulatedSheetQty: number = item.currentQty;
    if (item.sku === 'ENG-OIL-15W40' && item.boatId === 'boat-sovereign') {
      // Baseline was 6, App was updated to 4 after oil change, while Chief Engineer entered 7 in Google Sheets
      simulatedSheetQty = item.sheetBaselineQty === item.currentQty ? item.currentQty : 7;
    } else if (item.sku === 'PRV-CHM-DOM' && item.boatId === 'boat-aurelia') {
      // Sheet has updated count from chandlery delivery
      simulatedSheetQty = 18;
    }

    const appChanged = item.currentQty !== baseline;
    const sheetChanged = simulatedSheetQty !== baseline;

    let validationStatus: SheetRowPreview['validationStatus'] = 'VALID';
    let validationMessage = 'Ready to synchronize';

    if (
      appChanged &&
      sheetChanged &&
      item.currentQty !== simulatedSheetQty
    ) {
      validationStatus = 'CONFLICT';
      validationMessage = `Conflict: App (${item.currentQty}) and Sheet (${simulatedSheetQty}) both modified since last sync baseline (${baseline}).`;
    } else if (item.currentQty !== simulatedSheetQty) {
      validationStatus = 'VALID';
      validationMessage = sheetChanged
        ? `Sheet updated (${baseline} → ${simulatedSheetQty}) — ready to import`
        : `App updated (${baseline} → ${item.currentQty}) — ready to push to Sheet`;
    } else {
      validationStatus = 'VALID';
      validationMessage = 'In sync (App & Sheet match)';
    }

    return {
      rowNumber,
      sku: item.sku,
      productName: item.productName,
      category: item.categoryName,
      sheetQty: simulatedSheetQty,
      sheetRequiredQty: item.requiredQty,
      unit: item.unit,
      appCurrentQty: item.currentQty,
      baselineQty: baseline,
      validationStatus,
      validationMessage,
    };
  });

  if (includeInvalidSample) {
    rows.push({
      rowNumber: rows.length + 2,
      sku: 'ENG-ANODE-ZN',
      productName: 'Hull Sacrificial Zinc Anodes (Set)',
      category: 'Engine & Mechanical',
      sheetQty: 'N/A (damaged text)',
      sheetRequiredQty: 8,
      unit: 'sets',
      appCurrentQty: undefined,
      baselineQty: undefined,
      validationStatus: 'INVALID',
      validationMessage: 'Column D (Current Qty) contains non-numeric value "N/A (damaged text)". Row blocked.',
    });
  }

  return rows;
}

export function validateColumnMapping(mapping: ColumnMapping): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const requiredFields: (keyof ColumnMapping)[] = [
    'sku',
    'productName',
    'category',
    'currentQty',
    'requiredQty',
    'unit',
  ];

  const usedColumns = new Set<string>();
  for (const field of requiredFields) {
    const col = (mapping[field] || '').trim().toUpperCase();
    if (!col || !/^[A-Z]{1,2}$/.test(col)) {
      errors.push(`Field "${field}" must map to a valid spreadsheet column letter (A-Z).`);
    } else if (usedColumns.has(col)) {
      errors.push(`Duplicate column letter "${col}" assigned to multiple fields.`);
    } else {
      usedColumns.add(col);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
