/**
 * Commission Payments API
 * Tracks PM commission installments tied to client progress payments.
 * Actual payment happens in QuickBooks — CRM is tracking only.
 */

import { supabase } from "@/lib/supabase";

export const commissionPaymentsAPI = {
  /** Get all commission payments, optionally filtered by PM or project */
  getAll: async (filters?: { profile_id?: string; project_id?: string }) => {
    let query = supabase
      .from("commission_payments")
      .select(`
        *,
        project:projects(id, name, commission, gross_profit, client:clients(first_name, last_name)),
        profile:profiles!commission_payments_profile_id_fkey(id, first_name, last_name, commission_rate),
        progress_payment:project_payments!commission_payments_progress_payment_id_fkey(id, label, amount, percentage),
        processed_by_profile:profiles!commission_payments_processed_by_fkey(id, first_name, last_name)
      `)
      .order("created_at", { ascending: false });

    if (filters?.profile_id) query = query.eq("profile_id", filters.profile_id);
    if (filters?.project_id) query = query.eq("project_id", filters.project_id);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Get pending commissions only */
  getPending: async () => {
    const { data, error } = await supabase
      .from("commission_payments")
      .select(`
        *,
        project:projects(id, name, commission, gross_profit, client:clients(first_name, last_name)),
        profile:profiles!commission_payments_profile_id_fkey(id, first_name, last_name, commission_rate),
        progress_payment:project_payments!commission_payments_progress_payment_id_fkey(id, label, amount, percentage)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Auto-create commission installment when a progress payment is marked paid */
  createFromProgressPayment: async (
    project_id: string,
    progress_payment_id: string,
    profile_id: string,
    amount: number
  ) => {
    // Check if already exists for this progress payment
    const { data: existing } = await supabase
      .from("commission_payments")
      .select("id")
      .eq("progress_payment_id", progress_payment_id)
      .maybeSingle();
    if (existing) return; // already created, skip

    const { error } = await supabase
      .from("commission_payments")
      .insert({ project_id, progress_payment_id, profile_id, amount, status: "pending" });
    if (error) throw new Error(error.message);
  },

  /** Update amount (manual edit) or mark as processed */
  update: async (id: string, updates: { amount?: number; status?: string; notes?: string }) => {
    const payload: any = { ...updates };
    if (updates.status === "processed") {
      const { data: { user } } = await supabase.auth.getUser();
      payload.processed_date = new Date().toISOString().split("T")[0];
      payload.processed_by = user?.id;
    }
    const { data, error } = await supabase
      .from("commission_payments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete a specific commission payment by ID (admin correction) */
  deleteById: async (id: string) => {
    const { error } = await supabase
      .from("commission_payments")
      .delete()
      .eq("id", id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
  },

  /** Manually record a cash payout to a PM (not tied to a milestone) */
  createManualPayout: async (profile_id: string, amount: number, notes?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("commission_payments")
      .insert({
        profile_id,
        amount,
        status: "processed",
        payout_type: "manual_payout",
        processed_date: new Date().toISOString().split("T")[0],
        processed_by: user?.id ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete a manual payout (admin correction) */
  deleteManualPayout: async (id: string) => {
    const { error } = await supabase
      .from("commission_payments")
      .delete()
      .eq("id", id)
      .eq("payout_type", "manual_payout");
    if (error) throw new Error(error.message);
  },

  /** Delete a commission payment (e.g. if progress payment toggled back to unpaid) */
  deleteByProgressPayment: async (progress_payment_id: string) => {
    const { error } = await supabase
      .from("commission_payments")
      .delete()
      .eq("progress_payment_id", progress_payment_id)
      .eq("status", "pending"); // only delete if not yet processed
    if (error) throw new Error(error.message);
  },
};
