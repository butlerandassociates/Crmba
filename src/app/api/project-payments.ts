/**
 * Project Payments API
 * Manually tracked payment milestones per project.
 */

import { supabase } from "@/lib/supabase";

export const projectPaymentsAPI = {
  /** All payment milestones for a project */
  getByProject: async (project_id: string) => {
    const { data, error } = await supabase
      .from("project_payments")
      .select("*")
      .eq("project_id", project_id)
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** All payment milestones for a client (across all their projects) */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("project_payments")
      .select("*, project:projects(id, name)")
      .eq("client_id", client_id)
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Batch-update sort_order for all milestones after a drag-to-reorder */
  reorder: async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) =>
      supabase.from("project_payments").update({ sort_order: i }).eq("id", id)
    );
    await Promise.all(updates);
  },

  /** Create a new payment milestone */
  create: async (payment: {
    project_id: string;
    client_id?: string;
    label: string;
    percentage?: number;
    amount: number;
    base_amount?: number;
    stripe_fee_enabled?: boolean;
    sort_order?: number;
    notes?: string;
    due_date?: string;
    payment_method?: string;
    is_deposit?: boolean;
  }) => {
    const { data, error } = await supabase
      .from("project_payments")
      .insert(payment)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update a payment milestone (edit label/amount/percentage or mark paid) */
  update: async (id: string, updates: {
    label?: string;
    percentage?: number;
    amount?: number;
    base_amount?: number;
    stripe_fee_enabled?: boolean;
    is_paid?: boolean;
    paid_date?: string | null;
    notes?: string;
    due_date?: string | null;
    payment_method?: string | null;
    paid_by?: string | null;
    is_deposit?: boolean;
  }) => {
    const { data, error } = await supabase
      .from("project_payments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete a payment milestone */
  delete: async (id: string) => {
    const { error } = await supabase
      .from("project_payments")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },

  /** Seed default 3 milestones (Deposit/Progress/Final) for a new project */
  seedDefaults: async (project_id: string, totalValue: number) => {
    const defaults = [
      { project_id, label: "Deposit", percentage: 30, amount: totalValue * 0.3, sort_order: 0 },
      { project_id, label: "Progress Payment", percentage: 40, amount: totalValue * 0.4, sort_order: 1 },
      { project_id, label: "Final Payment", percentage: 30, amount: totalValue * 0.3, sort_order: 2 },
    ];
    const { data, error } = await supabase
      .from("project_payments")
      .insert(defaults)
      .select();
    if (error) throw new Error(error.message);
    return data;
  },
};
