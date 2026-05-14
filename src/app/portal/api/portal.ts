/**
 * Portal API — called from ClientPortalPage with the URL token.
 * Goes through the validate-portal-token edge function (service role key),
 * never touches Supabase tables directly from the client.
 */

import { supabase } from "@/lib/supabase";

export interface PortalClient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface PortalProject {
  id: string;
  total_value: number;
  start_date: string | null;
  end_date: string | null;
  target_date: string | null;
  progress_pct: number;
  project_type: string | null;
  days_total: number | null;
  portal_enabled: boolean;
  project_manager: { first_name: string; last_name: string; phone: string | null } | null;
}

export interface PortalPhase {
  id: string;
  label: string;
  order_index: number;
  status: "upcoming" | "in-progress" | "complete";
  progress_pct: number;
  expected_date: string | null;
  completed_date: string | null;
}

export interface PortalPayment {
  id: string;
  label: string;
  amount: number;
  is_paid: boolean;
  due_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
  confirmation_code: string | null;
  breakdown: { label: string; amount: number }[] | null;
  sort_order: number | null;
  percentage: number | null;
  notes: string | null;
}

export interface PortalPhoto {
  id: string;
  public_url: string | null;
  label: string | null;
  order_index: number;
}

export interface PortalUpdate {
  id: string;
  title: string;
  body: string;
  completed_items: string[];
  upcoming_items: string[];
  posted_at: string;
  posted_by_profile: { first_name: string; last_name: string } | null;
  photos: PortalPhoto[];
}

export interface PortalFile {
  id: string;
  file_name: string;
  file_url: string | null;
  category: string;
  created_at: string;
  file_size: number | null;
}

export interface PortalData {
  client: PortalClient;
  project: PortalProject | null;
  phases: PortalPhase[];
  payments: PortalPayment[];
  updates: PortalUpdate[];
  files: PortalFile[];
}

export async function validatePortalToken(token: string): Promise<PortalData | null> {
  const { data: fnData, error: fnError } = await supabase.functions.invoke(
    "validate-portal-token",
    {
      body: {
        token,
        ip: "client",
        ua: navigator.userAgent,
      },
    }
  );

  if (fnError || !fnData?.valid) {
    return null;
  }

  return fnData as PortalData;
}
