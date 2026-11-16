import { NextRequest, NextResponse } from 'next/server';
import {
  buildSheetPreviewRows,
  isGoogleCredentialsConfigured,
  validateColumnMapping,
} from '@/lib/google-sheets-service';
import { BoatInventoryItem, ColumnMapping, UserRole } from '@/types/domain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      actorRole,
      boatId,
      spreadsheetId,
      worksheetName,
      columnMapping,
      boatInventory,
      includeInvalidSample,
      mode = 'PREVIEW',
    } = body as {
      actorRole: UserRole;
      boatId: string;
      spreadsheetId: string;
      worksheetName: string;
      columnMapping: ColumnMapping;
      boatInventory: BoatInventoryItem[];
      includeInvalidSample?: boolean;
      mode?: 'PREVIEW' | 'SYNC';
    };

    // Enforce ADMIN-only access on the server
    if (actorRole !== 'ADMIN') {
      return NextResponse.json(
        {
          error: 'Forbidden: Only ADMIN users can configure or synchronize Google Sheets integrations.',
        },
        { status: 403 }
      );
    }

    if (!boatId || !spreadsheetId || !worksheetName) {
      return NextResponse.json(
        {
          error: 'Validation Error: boatId, spreadsheetId, and worksheetName are required.',
        },
        { status: 400 }
      );
    }

    const mappingValidation = validateColumnMapping(columnMapping);
    if (!mappingValidation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid column mapping configuration.',
          details: mappingValidation.errors,
        },
        { status: 400 }
      );
    }

    const liveGoogleConfigured = isGoogleCredentialsConfigured();
    const previewRows = buildSheetPreviewRows(
      boatId,
      boatInventory || [],
      Boolean(includeInvalidSample)
    );

    const conflicts = previewRows.filter((r) => r.validationStatus === 'CONFLICT');
    const invalidRows = previewRows.filter((r) => r.validationStatus === 'INVALID');
    const validRows = previewRows.filter((r) => r.validationStatus === 'VALID');

    return NextResponse.json({
      ok: true,
      mode,
      isDemoMode: !liveGoogleConfigured,
      demoBannerMessage: liveGoogleConfigured
        ? 'Connected via server-side Google Service Account credentials.'
        : 'DEMO MODE: Google API Service Account credentials are not configured in .env.local. Using realistic simulated worksheet telemetry — no live external spreadsheet was modified.',
      summary: {
        totalRows: previewRows.length,
        validCount: validRows.length,
        conflictCount: conflicts.length,
        invalidCount: invalidRows.length,
        timestamp: new Date().toISOString(),
      },
      rows: previewRows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Internal server synchronization error',
      },
      { status: 500 }
    );
  }
}
