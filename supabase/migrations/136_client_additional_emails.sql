-- Additional client emails (Jonathan, Nov 2 2026):
--   "can you give me the ability to add another email for users here? Sometimes, both homeowners/spouses want to
--    be sent proposals too and they should be able to click the 'view proposal' email in the event there's two
--    emails listed here. Should be a prompt telling us to enter additional emails spaced by a comma."
--
-- clients.email stays the single primary address (DocuSign, portal, receipts and everything else keep using it).
-- This adds an optional comma-separated list of extra addresses that also receive proposal emails.
-- Additive only, nullable, safe to re-run. Run BEFORE deploying the code that saves it.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS additional_emails text;

COMMENT ON COLUMN public.clients.additional_emails IS 'Optional extra client email addresses, comma-separated (e.g. a spouse). They are added to the To line of proposal / client emails; clients.email remains the primary address.';
