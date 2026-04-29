-- Add adjustable forecast probability columns to company_settings
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS forecast_prob_prospect  integer NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS forecast_prob_scheduled integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS forecast_prob_selling   integer NOT NULL DEFAULT 60;
