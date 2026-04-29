-- Add direct sales_rep_id to clients for Prospect/Scheduled stage assignment
-- (Selling/Sold/Active/Completed use projects.sales_rep_id)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sales_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_sales_rep_id ON clients(sales_rep_id);
