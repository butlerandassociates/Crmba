/**
 * Projects API
 * Full project CRUD with joined client + team member details.
 */

import { supabase } from "@/lib/supabase";

const mapProject = (p: any) => ({
  ...p,
  startDate:          p.start_date      ?? null,
  endDate:            p.end_date        ?? null,
  totalValue:         Number(p.total_value      ?? 0),
  totalCosts:         Number(p.total_costs      ?? 0),
  grossProfit:        Number(p.gross_profit     ?? 0),
  profitMargin:       Number(p.profit_margin    ?? 0),
  commission:            Number(p.commission                ?? 0),
  commissionRate:        Number(p.commission_rate           ?? 0),
  pmCommissionRate:      Number(p.project_manager?.commission_rate ?? p.commission_rate ?? 0),
  salesRepCommission:    Number(p.sales_rep_commission      ?? 0),
  salesRepCommissionRate:Number(p.sales_rep_commission_rate || p.sales_rep?.commission_rate || 0),
  clientName: p.client
    ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() || p.client.company
    : "",
  projectManagerName:     p.project_manager ? `${p.project_manager.first_name ?? ""} ${p.project_manager.last_name ?? ""}`.trim() : "",
  projectManagerActive:   p.project_manager?.is_active ?? true,
  foremanName:            p.foreman ? `${p.foreman.first_name ?? ""} ${p.foreman.last_name ?? ""}`.trim() : "",
  foremanPhone:           p.foreman?.phone ?? null,
  foremanEmail:           p.foreman?.email ?? null,
  foremanId:              p.foreman?.id ?? p.foreman_id ?? null,
  foremanActive:          p.foreman?.is_active ?? true,
  salesRepName:           p.sales_rep ? `${p.sales_rep.first_name ?? ""} ${p.sales_rep.last_name ?? ""}`.trim() : "",
  salesRepActive:         p.sales_rep?.is_active ?? true,
});

const FULL_SELECT = `
  *,
  client:clients(id, first_name, last_name, company, is_discarded),
  project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, is_active, commission_rate),
  foreman:profiles!projects_foreman_id_fkey(id, first_name, last_name, phone, email, is_active),
  sales_rep:profiles!projects_sales_rep_id_fkey(id, first_name, last_name, is_active, commission_rate)
`;

export const projectsAPI = {
  /** All projects with client name + assigned team members */
  getAll: async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(FULL_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((p) => p.client && !p.client.is_discarded)
      .map(mapProject);
  },

  /** Single project with full client contact details */
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        client:clients(id, first_name, last_name, company, email, phone),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, is_active, commission_rate),
        foreman:profiles!projects_foreman_id_fkey(id, first_name, last_name, phone, email, is_active),
        sales_rep:profiles!projects_sales_rep_id_fkey(id, first_name, last_name, is_active, commission_rate)
      `)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return mapProject(data);
  },

  /** Create a project */
  create: async (p: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("projects")
      .insert(p)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update project fields */
  update: async (id: string, p: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("projects")
      .update(p)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Hard delete */
  delete: async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
