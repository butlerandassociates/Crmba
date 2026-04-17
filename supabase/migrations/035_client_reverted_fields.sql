-- 035_client_reverted_fields.sql
-- Track who revived a discarded client and when

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS reverted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_by  uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_reverted_by ON clients(reverted_by);
