-- DocuSign Templates
-- Stores saved template name + UUID pairs managed in Admin → List Management
-- Used as fallback in the Send DocuSign dialog when live API fetch fails

CREATE TABLE IF NOT EXISTS docusign_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  template_id TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE docusign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read docusign_templates"
  ON docusign_templates FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can manage docusign_templates"
  ON docusign_templates FOR ALL
  TO authenticated USING (TRUE) WITH CHECK (TRUE);
