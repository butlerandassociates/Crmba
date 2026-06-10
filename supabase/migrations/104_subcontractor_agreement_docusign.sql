-- Migration 104: Subcontractor Agreement DocuSign tracking
-- Third DocuSign document (after contract = docusign_*, certificate = cert_docusign_*).
-- Signed by the project's foreman + Owner/GM (Jonathan), one per project/client.
-- Mirrors 087 exactly. Safe to re-run.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sub_docusign_status         text DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS sub_docusign_envelope_id    text,
  ADD COLUMN IF NOT EXISTS sub_docusign_sent_date      date,
  ADD COLUMN IF NOT EXISTS sub_docusign_completed_date timestamptz;

COMMENT ON COLUMN public.clients.sub_docusign_status         IS 'Subcontractor Agreement signing state — mirrors docusign_status (not_sent/preparing/sent_to_client/completed/declined/voided)';
COMMENT ON COLUMN public.clients.sub_docusign_envelope_id    IS 'DocuSign envelope ID for the Subcontractor Agreement (separate from contract + certificate envelopes)';
COMMENT ON COLUMN public.clients.sub_docusign_sent_date      IS 'Date the Subcontractor Agreement was sent for signature';
COMMENT ON COLUMN public.clients.sub_docusign_completed_date IS 'Timestamp the Subcontractor Agreement was fully signed';
