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
  project_type: string | null;
  days_total: number | null;
  portal_enabled: boolean;
  project_manager: { first_name: string; last_name: string; phone: string | null } | null;
}

export interface PortalPhaseTask {
  id: string;
  task_label: string;
  order_index: number;
  is_completed: boolean;
  photo_required: boolean;
  note_required: boolean;
  photo_url: string | null;
  note: string | null;
}

export interface PortalPhase {
  id: string;
  label: string;
  order_index: number;
  status: "upcoming" | "in-progress" | "complete";
  progress_pct: number;
  expected_date: string | null;
  completed_date: string | null;
  tasks: PortalPhaseTask[];
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
  stripe_fee_amount: number | null;
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
  phase_id: string | null;
  phase_label: string | null;
  posted_by_profile: { first_name: string; last_name: string } | null;
  photos: PortalPhoto[];
}

export interface PortalFile {
  id: string;
  file_name: string;
  file_url: string | null;
  file_type: string;
  created_at: string;
  file_size_bytes: number | null;
}

export interface PortalChangeOrderItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  category: string;
  sort_order: number;
}

export interface PortalChangeOrderModification {
  name: string;
  action: "edit" | "delete";
  category: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  delta: number;
}

export interface PortalChangeOrder {
  id: string;
  title: string;
  reason: string | null;
  timeline_impact: string | null;
  cost_impact: number;
  status: "pending_client" | "approved" | "rejected" | "merged";
  created_at: string;
  approval_verified: boolean | null;
  approval_file_url: string | null;
  approval_file_name: string | null;
  pdf_url: string | null;
  original_total: number | null;
  new_total: number | null;
  items: PortalChangeOrderItem[];
  modifications_display: PortalChangeOrderModification[];
}

export interface PortalProposalLineItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  client_price: number;
  sort_order: number;
}

export interface PortalProposal {
  id: string;
  title: string;
  status: "sent" | "accepted" | "declined";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  pdf_url: string | null;
  line_items: PortalProposalLineItem[];
}

export interface PortalData {
  client: PortalClient;
  project: PortalProject | null;
  phases: PortalPhase[];
  payments: PortalPayment[];
  updates: PortalUpdate[];
  files: PortalFile[];
  change_orders: PortalChangeOrder[];
  proposals: PortalProposal[];
}

export async function portalAction(
  token: string,
  action: "co_approve" | "co_reject" | "proposal_accept" | "proposal_decline",
  entityId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("portal-action", {
    body: { token, action, entity_id: entityId, comment },
  });
  if (error || !data?.success) {
    return { success: false, error: data?.error ?? error?.message ?? "Unknown error" };
  }
  return { success: true };
}

export async function createPaymentIntent(
  token: string,
  paymentId: string,
  clientId: string,
  amount: number
): Promise<{ clientSecret: string } | { error: string }> {
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: { token, payment_id: paymentId, client_id: clientId, amount },
  });
  if (error || !data?.client_secret) {
    return { error: data?.error ?? error?.message ?? "Failed to create payment" };
  }
  return { clientSecret: data.client_secret };
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
