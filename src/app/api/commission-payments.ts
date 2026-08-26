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
        project:projects(id, name, commission, gross_profit, total_value, client_id, client:clients(id, first_name, last_name)),
        profile:profiles!commission_payments_profile_id_fkey(id, first_name, last_name, commission_rate),
        progress_payment:project_payments!commission_payments_progress_payment_id_fkey(id, label, amount, percentage, is_deposit),
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
        project:projects(id, name, commission, gross_profit, total_value, client_id, client:clients(id, first_name, last_name)),
        profile:profiles!commission_payments_profile_id_fkey(id, first_name, last_name, commission_rate),
        progress_payment:project_payments!commission_payments_progress_payment_id_fkey(id, label, amount, percentage, is_deposit)
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
    // Dedup per (progress_payment_id, profile_id) — PM and Sales Rep each get their own row
    const { data: existing } = await supabase
      .from("commission_payments")
      .select("id")
      .eq("progress_payment_id", progress_payment_id)
      .eq("profile_id", profile_id)
      .maybeSingle();
    if (existing) return; // already created for this person, skip

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
    const { data: cp } = await supabase
      .from("commission_payments")
      .select("project_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("commission_payments")
      .delete()
      .eq("id", id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    // Sync projects.commission — zero if no pending installments remain
    if (cp?.project_id) {
      const { data: remaining } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("project_id", cp.project_id)
        .eq("status", "pending");
      const newCommission = (remaining ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      await supabase
        .from("projects")
        .update({ commission: newCommission, updated_at: new Date().toISOString() })
        .eq("id", cp.project_id);
    }
  },

  /** Manually record a cash payout to a PM (not tied to a milestone) */
  createManualPayout: async (profile_id: string, amount: number, notes?: string, project_id?: string) => {
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
        project_id: project_id ?? null,
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

  /**
   * Reconcile commission_payments for a given PM.
   * Re-sums pending installments and writes the correct value back to projects.commission.
   *
   * NOTE: no longer backfills a row per paid milestone — that produced commission based on
   * each milestone's dollar amount, which never matched the actual policy (PM commission =
   * rate × Gross Profit, confirmed by Jonathan Aug 27 2026). New commission rows are created
   * correctly at the source now (move-to-sold-modal.tsx, edit-project-dialog.tsx). This
   * function only re-syncs the summary field from whatever pending rows already exist — it
   * does not create or change any row amounts, so it's safe to keep running without touching
   * historical data on projects other than the one explicitly corrected.
   */
  reconcileForPM: async (profile_id: string) => {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, commission")
      .eq("project_manager_id", profile_id);
    if (!projects?.length) return;

    await Promise.all(
      projects.map(async (proj) => {
        const { data: pending } = await supabase
          .from("commission_payments")
          .select("amount")
          .eq("project_id", proj.id)
          .eq("profile_id", profile_id)
          .eq("status", "pending");
        const correct = (pending ?? []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
        if (Math.abs(correct - Number(proj.commission)) > 0.01) {
          await supabase
            .from("projects")
            .update({ commission: correct, updated_at: new Date().toISOString() })
            .eq("id", proj.id);
        }
      })
    );
  },

  /** Same as reconcileForPM but for sales reps — re-syncs projects.sales_rep_commission from existing pending rows only. */
  reconcileForSalesRep: async (profile_id: string) => {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, sales_rep_commission")
      .eq("sales_rep_id", profile_id);
    if (!projects?.length) return;

    await Promise.all(
      projects.map(async (proj) => {
        const { data: pending } = await supabase
          .from("commission_payments")
          .select("amount")
          .eq("project_id", proj.id)
          .eq("profile_id", profile_id)
          .eq("status", "pending");
        const correct = (pending ?? []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
        if (Math.abs(correct - Number(proj.sales_rep_commission)) > 0.01) {
          await supabase
            .from("projects")
            .update({ sales_rep_commission: correct, updated_at: new Date().toISOString() })
            .eq("id", proj.id);
        }
      })
    );
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
