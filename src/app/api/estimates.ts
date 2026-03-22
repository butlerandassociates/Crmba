/**
 * Estimates API
 * Create, manage, and track proposals/estimates with line items and payment schedules.
 */

import { supabase } from "@/lib/supabase";

export const estimatesAPI = {
  /** All estimates with client name — for list views */
  getAll: async () => {
    const { data, error } = await supabase
      .from("estimates")
      .select(`*, client:clients(first_name, last_name)`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Estimates for a specific client */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("estimates")
      .select(`*, line_items:estimate_line_items(*), payment_schedules(*)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Full estimate detail with client contact info + line items */
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("estimates")
      .select(`
        *,
        client:clients(first_name, last_name, email, phone, address, city, state, zip),
        line_items:estimate_line_items(*),
        payment_schedules(*)
      `)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Create estimate + line items + payment schedules in one call */
  create: async (
    estimate: Record<string, unknown>,
    lineItems: Record<string, unknown>[],
    paymentSchedules: Record<string, unknown>[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { count } = await supabase
      .from("estimates")
      .select("*", { count: "exact", head: true });
    const estimateNumber = 1000 + (count ?? 0) + 1;

    const { data: est, error: estError } = await supabase
      .from("estimates")
      .insert({ ...estimate, created_by: user?.id, estimate_number: estimateNumber })
      .select()
      .single();
    if (estError) throw new Error(estError.message);

    if (lineItems.length > 0) {
      const { error } = await supabase
        .from("estimate_line_items")
        .insert(lineItems.map((li) => ({ ...li, estimate_id: est.id })));
      if (error) throw new Error(error.message);
    }

    if (paymentSchedules.length > 0) {
      const { error } = await supabase
        .from("payment_schedules")
        .insert(paymentSchedules.map((ps) => ({ ...ps, estimate_id: est.id })));
      if (error) throw new Error(error.message);
    }

    return est;
  },

  /** Update estimate fields */
  update: async (id: string, estimate: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("estimates")
      .update(estimate)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update status and set relevant timestamp (sent_at, accepted_at, declined_at) */
  updateStatus: async (id: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "sent")     updates.sent_at     = new Date().toISOString();
    if (status === "accepted") updates.accepted_at = new Date().toISOString();
    if (status === "declined") updates.declined_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("estimates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Replace all line items for an estimate */
  updateLineItems: async (estimate_id: string, lineItems: Record<string, unknown>[]) => {
    await supabase.from("estimate_line_items").delete().eq("estimate_id", estimate_id);
    if (lineItems.length > 0) {
      const { error } = await supabase
        .from("estimate_line_items")
        .insert(lineItems.map((li) => ({ ...li, estimate_id })));
      if (error) throw new Error(error.message);
    }
  },

  /** Delete estimate and all related records (cascade) */
  delete: async (id: string) => {
    const { error } = await supabase.from("estimates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};
