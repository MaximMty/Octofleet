import { NextRequest, NextResponse } from 'next/server';
import { canUserAccessBoat } from '@/lib/inventory-math';
import { SEED_BOATS, SEED_USERS } from '@/lib/seed-data';

/**
 * Server-side authorization guard endpoint.
 * Verifies user role permissions and strict Owner boat isolation on the backend.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, action, targetBoatId } = await request.json();

    const user = SEED_USERS.find((u) => u.id === userId);
    if (!user || !user.isActive) {
      return NextResponse.json(
        { authorized: false, reason: 'Unauthenticated or deactivated user profile.' },
        { status: 401 }
      );
    }

    // Admin-only actions
    const adminOnlyActions = [
      'MANAGE_USERS',
      'CREATE_BOAT',
      'CONFIGURE_GOOGLE_SHEETS',
      'MANAGE_SYSTEM_SETTINGS',
      'EDIT_CATALOG_SPECS',
    ];
    if (adminOnlyActions.includes(action) && user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          authorized: false,
          reason: `Role ${user.role} is prohibited from performing administrative action ${action}.`,
        },
        { status: 403 }
      );
    }

    // Master/Admin actions
    const masterOrAdminActions = ['REVIEW_RESTOCK_REQUEST', 'RECORD_STOCK_MOVEMENT'];
    if (masterOrAdminActions.includes(action) && user.role === 'OWNER') {
      return NextResponse.json(
        {
          authorized: false,
          reason: 'OWNER role cannot approve restock requests or directly adjust stock ledgers.',
        },
        { status: 403 }
      );
    }

    // Boat-level isolation check
    if (targetBoatId) {
      const boat = SEED_BOATS.find((b) => b.id === targetBoatId);
      if (!boat) {
        return NextResponse.json(
          { authorized: false, reason: 'Target vessel not found.' },
          { status: 404 }
        );
      }

      if (!canUserAccessBoat(user, boat)) {
        return NextResponse.json(
          {
            authorized: false,
            reason: `Access Denied: User ${user.fullName} (${user.role}) is not authorized to access vessel ${boat.name}.`,
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      authorized: true,
      role: user.role,
      userId: user.id,
    });
  } catch {
    return NextResponse.json(
      { authorized: false, reason: 'Invalid authorization payload.' },
      { status: 400 }
    );
  }
}
