-- Add insurance expiration date to foreman profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS insurance_expiration_date date DEFAULT NULL;

COMMENT ON COLUMN profiles.insurance_expiration_date IS 'Insurance expiration date for foreman — admin sets, bell alert fires when within 30 days';
