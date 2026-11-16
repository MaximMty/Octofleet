-- ============================================================================
-- OCTOFLEET — YACHT INVENTORY & FLEET MANAGEMENT PLATFORM
-- PostgreSQL Schema & Row Level Security (RLS) Policies for Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ENUMS & CUSTOM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'MASTER', 'OWNER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE movement_type AS ENUM ('ADDED', 'REMOVED', 'ADJUSTED', 'TRANSFERRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE restock_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM ('CONNECTED', 'SYNCING', 'CONFLICT', 'ERROR', 'DISCONNECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'OWNER',
    title TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ----------------------------------------------------------------------------
-- 3. BOATS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    vessel_class TEXT NOT NULL DEFAULT 'Motor Yacht',
    length_meters NUMERIC(6, 2),
    home_port TEXT,
    image_url TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    master_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT,
    specification_tier TEXT NOT NULL DEFAULT 'MCA LY3 Commercial Standard',
    google_sheet_id TEXT,
    google_worksheet_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boats_owner_id ON public.boats(owner_id);
CREATE INDEX IF NOT EXISTS idx_boats_master_id ON public.boats(master_id);

-- ----------------------------------------------------------------------------
-- 4. BOAT_MEMBERS TABLE (Multi-owner / multi-master support per boat)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boat_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    member_role user_role NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(boat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boat_members_boat_id ON public.boat_members(boat_id);
CREATE INDEX IF NOT EXISTS idx_boat_members_user_id ON public.boat_members(user_id);

-- ----------------------------------------------------------------------------
-- 5. INVENTORY_CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. INVENTORY_ITEMS TABLE (Catalog / Master Specification Items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.inventory_categories(id) ON DELETE RESTRICT,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'units',
    default_required_qty NUMERIC(12, 2) NOT NULL DEFAULT 1,
    default_min_warning_qty NUMERIC(12, 2) NOT NULL DEFAULT 1,
    default_max_qty NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(sku);

-- ----------------------------------------------------------------------------
-- 7. BOAT_INVENTORY TABLE (Per-Boat Stock & Specification)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boat_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    current_qty NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
    required_qty NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (required_qty >= 0),
    min_warning_qty NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_warning_qty >= 0),
    max_qty NUMERIC(12, 2),
    sheet_row_index INT,
    sheet_baseline_qty NUMERIC(12, 2),
    last_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(boat_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_boat_inventory_boat_id ON public.boat_inventory(boat_id);
CREATE INDEX IF NOT EXISTS idx_boat_inventory_item_id ON public.boat_inventory(item_id);

-- ----------------------------------------------------------------------------
-- 8. STOCK_MOVEMENTS TABLE (Immutable Ledger of Inventory Changes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    boat_inventory_id UUID NOT NULL REFERENCES public.boat_inventory(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type movement_type NOT NULL,
    previous_qty NUMERIC(12, 2) NOT NULL,
    new_qty NUMERIC(12, 2) NOT NULL,
    delta_qty NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    reference_code TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_boat_id ON public.stock_movements(boat_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. RESTOCK_REQUESTS & RESTOCK_REQUEST_ITEMS TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restock_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_code TEXT UNIQUE NOT NULL,
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status restock_status NOT NULL DEFAULT 'PENDING',
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    reason TEXT NOT NULL,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_comment TEXT,
    reviewed_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restock_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restock_request_id UUID NOT NULL REFERENCES public.restock_requests(id) ON DELETE CASCADE,
    boat_inventory_id UUID REFERENCES public.boat_inventory(id) ON DELETE SET NULL,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    current_qty_snapshot NUMERIC(12, 2) NOT NULL,
    required_qty_snapshot NUMERIC(12, 2) NOT NULL,
    requested_qty NUMERIC(12, 2) NOT NULL CHECK (requested_qty > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restock_requests_boat_id ON public.restock_requests(boat_id);
CREATE INDEX IF NOT EXISTS idx_restock_requests_status ON public.restock_requests(status);

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_role user_role,
    boat_id UUID REFERENCES public.boats(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_boat_id ON public.notifications(boat_id);

-- ----------------------------------------------------------------------------
-- 11. AUDIT_LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    actor_role user_role NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 12. GOOGLE_SHEET_INTEGRATIONS & SYNC_LOGS TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_sheet_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID UNIQUE NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    spreadsheet_id TEXT NOT NULL,
    spreadsheet_name TEXT NOT NULL,
    worksheet_name TEXT NOT NULL DEFAULT 'Inventory',
    column_mapping JSONB NOT NULL DEFAULT '{
        "sku": "A",
        "productName": "B",
        "category": "C",
        "currentQty": "D",
        "requiredQty": "E",
        "unit": "F",
        "lastUpdated": "G"
    }'::jsonb,
    sync_direction TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
    status sync_status NOT NULL DEFAULT 'CONNECTED',
    is_demo_mode BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    last_sync_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.google_sheet_integrations(id) ON DELETE CASCADE,
    boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    records_processed INT NOT NULL DEFAULT 0,
    records_updated INT NOT NULL DEFAULT 0,
    conflicts_detected INT NOT NULL DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '[]'::jsonb,
    initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_boat_id ON public.sync_logs(boat_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs(created_at DESC);

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_boat_access(target_boat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
    OR EXISTS (
        SELECT 1 FROM public.boats b
        WHERE b.id = target_boat_id
          AND (b.owner_id = auth.uid() OR b.master_id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.boat_members bm
        WHERE bm.boat_id = target_boat_id
          AND bm.user_id = auth.uid()
    );
$$;

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheet_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "Masters and Owners can read active profiles"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.current_user_role() IN ('ADMIN', 'MASTER'));

-- Boats Policies (Strict owner isolation)
CREATE POLICY "Admins have full access to boats"
    ON public.boats FOR ALL
    USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "Masters and Owners can only view assigned boats"
    ON public.boats FOR SELECT
    USING (public.has_boat_access(id));

-- Boat Members Policies
CREATE POLICY "Admins manage boat members"
    ON public.boat_members FOR ALL
    USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "Assigned members can view boat membership"
    ON public.boat_members FOR SELECT
    USING (public.has_boat_access(boat_id));

-- Inventory Categories & Items Policies
CREATE POLICY "All authenticated users can view categories and items"
    ON public.inventory_categories FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Only Admins can mutate categories"
    ON public.inventory_categories FOR ALL
    USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "All authenticated users can view catalog items"
    ON public.inventory_items FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Only Admins can mutate catalog items"
    ON public.inventory_items FOR ALL
    USING (public.current_user_role() = 'ADMIN');

-- Boat Inventory Policies (Owners strictly isolated to their boats)
CREATE POLICY "Users can view inventory only for accessible boats"
    ON public.boat_inventory FOR SELECT
    USING (public.has_boat_access(boat_id));

CREATE POLICY "Admins and assigned Masters can update boat inventory"
    ON public.boat_inventory FOR ALL
    USING (
        public.current_user_role() = 'ADMIN'
        OR (public.current_user_role() = 'MASTER' AND public.has_boat_access(boat_id))
    );

-- Stock Movements Policies
CREATE POLICY "Users can view stock movements only for accessible boats"
    ON public.stock_movements FOR SELECT
    USING (public.has_boat_access(boat_id));

CREATE POLICY "Admins and assigned Masters can insert stock movements"
    ON public.stock_movements FOR INSERT
    WITH CHECK (
        public.current_user_role() = 'ADMIN'
        OR (public.current_user_role() = 'MASTER' AND public.has_boat_access(boat_id))
    );

-- Restock Requests Policies
CREATE POLICY "Users can view restock requests for accessible boats"
    ON public.restock_requests FOR SELECT
    USING (public.has_boat_access(boat_id));

CREATE POLICY "Owners, Masters, and Admins can create restock requests for accessible boats"
    ON public.restock_requests FOR INSERT
    WITH CHECK (public.has_boat_access(boat_id) AND requested_by = auth.uid());

CREATE POLICY "Admins and assigned Masters can update restock requests"
    ON public.restock_requests FOR UPDATE
    USING (
        public.current_user_role() = 'ADMIN'
        OR (public.current_user_role() = 'MASTER' AND public.has_boat_access(boat_id))
    );

-- Restock Request Items Policies
CREATE POLICY "Users can view restock request items for accessible boats"
    ON public.restock_request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.restock_requests rr
            WHERE rr.id = restock_request_id
              AND public.has_boat_access(rr.boat_id)
        )
    );

CREATE POLICY "Users can insert restock request items for accessible boats"
    ON public.restock_request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restock_requests rr
            WHERE rr.id = restock_request_id
              AND public.has_boat_access(rr.boat_id)
        )
    );

-- Notifications Policies
CREATE POLICY "Users can view their own or boat notifications"
    ON public.notifications FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.current_user_role() = 'ADMIN'
        OR (boat_id IS NOT NULL AND public.has_boat_access(boat_id) AND (target_role IS NULL OR target_role = public.current_user_role()))
    );

CREATE POLICY "Users can mark accessible notifications as read"
    ON public.notifications FOR UPDATE
    USING (
        user_id = auth.uid()
        OR public.current_user_role() = 'ADMIN'
        OR (boat_id IS NOT NULL AND public.has_boat_access(boat_id))
    );

-- Audit Logs Policies
CREATE POLICY "Admins and Masters can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.current_user_role() IN ('ADMIN', 'MASTER'));

-- Google Sheets Integrations & Sync Logs (Admin only)
CREATE POLICY "Only Admins can manage Google Sheet integrations"
    ON public.google_sheet_integrations FOR ALL
    USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "Admins and Masters can view sync logs for accessible boats"
    ON public.sync_logs FOR SELECT
    USING (
        public.current_user_role() = 'ADMIN'
        OR (public.current_user_role() = 'MASTER' AND public.has_boat_access(boat_id))
    );
