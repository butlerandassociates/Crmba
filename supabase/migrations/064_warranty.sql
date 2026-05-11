-- 064: Warranty sections and items for proposal PDF
CREATE TABLE public.warranty_sections (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.warranty_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id    uuid NOT NULL REFERENCES public.warranty_sections(id) ON DELETE CASCADE,
  scope_item    text NOT NULL,
  labor_text    text NOT NULL DEFAULT '',
  material_note text NOT NULL DEFAULT 'Manufacturer warranty only',
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.warranty_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_items    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warranty_sections_auth" ON public.warranty_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "warranty_items_auth"    ON public.warranty_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "warranty_sections_anon" ON public.warranty_sections FOR SELECT TO anon USING (true);
CREATE POLICY "warranty_items_anon"    ON public.warranty_items    FOR SELECT TO anon USING (true);

-- Disclaimer field on company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS warranty_disclaimer text;

-- Seed sections + items
DO $$
DECLARE
  s1 uuid; s2 uuid; s3 uuid;
BEGIN
  INSERT INTO public.warranty_sections (title, sort_order) VALUES ('Hardscaping', 0) RETURNING id INTO s1;
  INSERT INTO public.warranty_items (section_id, scope_item, labor_text, material_note, sort_order) VALUES
    (s1, 'Concrete Flatwork',  '1-year warranty on installation; cracking from base settling excluded after 90 days', 'Manufacturer warranty only', 0),
    (s1, 'Paver Installation', '2-year warranty on base compaction and pattern integrity; individual paver shifts from root or vehicle damage excluded', 'Manufacturer warranty only', 1),
    (s1, 'Retaining Walls',   '2-year warranty on structural integrity; excludes soil failure from unmanaged drainage or overloading', 'Manufacturer warranty only', 2),
    (s1, 'Edging & Borders',  '1-year warranty on placement and stability', 'Manufacturer warranty only', 3),
    (s1, 'Drainage Systems',  '1-year warranty on installation; blockage from debris not covered', 'Manufacturer warranty only', 4);

  INSERT INTO public.warranty_sections (title, sort_order) VALUES ('Outdoor Kitchens & Custom Structures', 1) RETURNING id INTO s2;
  INSERT INTO public.warranty_items (section_id, scope_item, labor_text, material_note, sort_order) VALUES
    (s2, 'Structural Frame & Base',  '2-year warranty on block, masonry, or steel frame construction', 'Manufacturer warranty only', 0),
    (s2, 'Countertop Installation',  '1-year warranty on countertops fabricated and installed directly by Butler & Associates. Third-party countertop work warranted solely through that subcontractor.', 'Manufacturer warranty only', 1),
    (s2, 'Tile & Stone Finishes',   '1-year warranty on installation; chemical discoloration or weather staining excluded', 'Manufacturer warranty only', 2),
    (s2, 'Built-in Rough-In',       '1-year warranty on openings per design plan; appliance function is manufacturer-only', 'Manufacturer warranty only', 3);

  INSERT INTO public.warranty_sections (title, sort_order) VALUES ('Artificial Grass', 2) RETURNING id INTO s3;
  INSERT INTO public.warranty_items (section_id, scope_item, labor_text, material_note, sort_order) VALUES
    (s3, 'Base Preparation',    '2-year warranty on compacted aggregate base and drainage layer', 'Manufacturer warranty only', 0),
    (s3, 'Turf Installation',   '1-year warranty on seaming, securing, and infill; pet damage or vehicle traffic excluded', 'Manufacturer warranty only', 1),
    (s3, 'Edging & Perimeter',  '1-year warranty on bender board or nailed perimeter securing', 'Manufacturer warranty only', 2);

  UPDATE public.company_settings SET warranty_disclaimer =
    'Organic & Living Materials: Butler & Associates does not warranty plants, trees, shrubs, sod, or any living materials. Survival and performance of organic materials depends on variables outside our control including watering practices, soil conditions, weather events, transplant shock, and pest or disease exposure. We stand fully behind the labor and installation — not the survival of the living material itself.';
END;
$$;
