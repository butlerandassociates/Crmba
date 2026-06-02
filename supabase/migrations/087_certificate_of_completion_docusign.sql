-- Migration 087: Certificate of Completion DocuSign tracking
-- Mirrors the existing contract DocuSign columns so the two documents are
-- tracked independently (contract = docusign_*, certificate = cert_docusign_*).
-- Safe to re-run.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cert_docusign_status         text DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS cert_docusign_envelope_id    text,
  ADD COLUMN IF NOT EXISTS cert_docusign_sent_date      date,
  ADD COLUMN IF NOT EXISTS cert_docusign_completed_date timestamptz;

COMMENT ON COLUMN public.clients.cert_docusign_status         IS 'Certificate of Completion signing state — mirrors docusign_status (not_sent/preparing/sent_to_client/completed/declined/voided)';
COMMENT ON COLUMN public.clients.cert_docusign_envelope_id    IS 'DocuSign envelope ID for the Certificate of Completion (separate from the contract envelope)';
COMMENT ON COLUMN public.clients.cert_docusign_sent_date      IS 'Date the Certificate of Completion was sent to the client';
COMMENT ON COLUMN public.clients.cert_docusign_completed_date IS 'Timestamp the Certificate of Completion was fully signed';
