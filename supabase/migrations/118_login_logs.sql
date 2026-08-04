CREATE TABLE login_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text,
  last_name text,
  role text,
  user_agent text,
  ip_address text,
  city text,
  country text,
  event_type text NOT NULL DEFAULT 'success' CHECK (event_type IN ('success', 'failed')),
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read; inserts are handled exclusively by edge functions using service role
CREATE POLICY "admins_read_login_logs" ON login_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
