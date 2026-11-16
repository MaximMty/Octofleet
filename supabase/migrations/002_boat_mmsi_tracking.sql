-- ============================================================================
-- 002: Live AIS tracking — link each vessel to its MMSI (MarineTraffic embed)
-- ============================================================================

ALTER TABLE public.boats
    ADD COLUMN IF NOT EXISTS mmsi TEXT
    CHECK (mmsi IS NULL OR mmsi ~ '^[0-9]{9}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_boats_mmsi_unique
    ON public.boats(mmsi)
    WHERE mmsi IS NOT NULL;
