-- Migration 090: Store the Everlance pre-rendered route map image per trip.
-- Everlance CSV exports include a "Map Image URL" column (a free static map image
-- of the route). We capture it on upload so the Trip Detail drawer can show a real
-- route map at zero API cost. Manual-entry trips simply have NULL here.
-- Safe to re-run.

ALTER TABLE public.mileage_trips
  ADD COLUMN IF NOT EXISTS map_image_url text;

COMMENT ON COLUMN public.mileage_trips.map_image_url IS 'Everlance static route map image URL (from CSV Map Image URL column); NULL for manual entries';
