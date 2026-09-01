/**
 * Clients API
 * CRUD + pipeline stage management for client records.
 */

import { supabase } from "@/lib/supabase";

export const clientsAPI = {
  /** List active clients for a given stage (or all stages if omitted) */
  getAll: async (stage?: string) => {
    let query = supabase
      .from("clients")
      .select(`
        id, first_name, last_name, email, phone, address, city, state, zip,
        status, pipeline_stage_id, lead_source_id, sales_rep_id,
        created_at, updated_at, is_discarded,
        docusign_status, appointment_met, appointment_scheduled,
        appointment_date, appointment_end_date,
        projected_value, closing_probability,
        lead_source:lead_sources(id, name),
        pipeline_stage:pipeline_stages(id, name, color, order_index),
        sales_rep:profiles!clients_sales_rep_id_fkey(first_name, last_name, is_active),
        projects(
          total_value, start_date, end_date, profit_margin, gross_profit, sales_rep_id, project_manager_id,
          project_manager:profiles!projects_project_manager_id_fkey(first_name, last_name, is_active),
          foreman:profiles!projects_foreman_id_fkey(first_name, last_name, is_active),
          sales_rep:profiles!projects_sales_rep_id_fkey(first_name, last_name, is_active)
        ),
        appointments(created_at, assigned_to, assigned_to_profile:profiles!assigned_to(first_name, last_name, role)),
        project_payments(id, is_paid, amount),
        estimates(id, total, status, created_at)
      `)
      .eq("is_discarded", false)
      .order("created_at", { ascending: false });
    if (stage) query = query.eq("status", stage);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => {
      const firstProject = (c.projects ?? [])[0];
      const project_total = (c.projects ?? []).reduce(
        (sum: number, p: any) => sum + (p.total_value ?? 0),
        0
      );
      const project_start_date  = firstProject?.start_date  ?? null;
      const project_end_date    = firstProject?.end_date    ?? null;
      const project_profit_margin = firstProject?.profit_margin != null ? Number(firstProject.profit_margin) : null;
      const project_gross_profit = firstProject?.gross_profit != null ? Number(firstProject.gross_profit) : null;

      const projectSalesRepName = firstProject?.sales_rep
        ? `${firstProject.sales_rep.first_name ?? ""} ${firstProject.sales_rep.last_name ?? ""}`.trim()
        : null;
      const clientSalesRepName = c.sales_rep
        ? `${c.sales_rep.first_name ?? ""} ${c.sales_rep.last_name ?? ""}`.trim()
        : null;
      const firstAppt = (c.appointments ?? [])
        .slice()
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      const apptSalesRepName = firstAppt?.assigned_to_profile
        ? `${firstAppt.assigned_to_profile.first_name ?? ""} ${firstAppt.assigned_to_profile.last_name ?? ""}`.trim()
        : null;
      const salesRepName = projectSalesRepName || clientSalesRepName || apptSalesRepName || null;
      const salesRepId: string | null = firstProject?.sales_rep_id ?? c.sales_rep_id ?? firstAppt?.assigned_to ?? null;
      const pmId: string | null = firstProject?.project_manager_id ?? null;
      const pmName = firstProject?.project_manager
        ? `${firstProject.project_manager.first_name ?? ""} ${firstProject.project_manager.last_name ?? ""}`.trim()
        : null;
      const foremanName = firstProject?.foreman
        ? `${firstProject.foreman.first_name ?? ""} ${firstProject.foreman.last_name ?? ""}`.trim()
        : null;
      const project_staff_label = `${salesRepName || "—"} / ${pmName || "—"}`;

      const payments = c.project_payments ?? [];
      const totalAmount = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const paidAmount = payments.filter((p: any) => p.is_paid).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const payment_progress_pct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : null;

      const latestProposal = (c.estimates ?? []).find((e: any) => e.status === "accepted")
        ?? (c.estimates ?? []).filter((e: any) => e.status !== "declined" && e.status !== "voided").sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        ...c,
        project_total,
        project_start_date,
        project_end_date,
        project_profit_margin,
        project_gross_profit,
        project_staff_label,
        salesRepName,
        salesRepId,
        pmId,
        pmName,
        foremanName,
        payment_progress_pct,
        proposal_forecast: latestProposal?.total ?? 0,
      };
    });
  },

  /** Discarded / archived clients */
  getDiscarded: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select(`*, lead_source:lead_sources(id,name), pipeline_stage:pipeline_stages(id,name,color)`)
      .eq("is_discarded", true)
      .order("discarded_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Single client with full details */
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select(`*, lead_source:lead_sources(id,name), pipeline_stage:pipeline_stages(id,name,color,order_index), sales_rep:profiles!clients_sales_rep_id_fkey(id,first_name,last_name,commission_rate)`)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Create a new client (created_by + sales_rep_id auto-set from current session) */
  create: async (client: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...client, created_by: user?.id ?? null, sales_rep_id: user?.id ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update any client fields */
  update: async (id: string, client: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("clients")
      .update(client)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Soft-delete — moves to discarded list */
  discard: async (id: string, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("clients")
      .update({ is_discarded: true, discarded_at: new Date().toISOString(), discarded_reason: reason ?? null, discarded_by: user?.id ?? null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Restore a discarded client */
  restore: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("clients")
      .update({ is_discarded: false, reverted_at: new Date().toISOString(), reverted_by: user?.id ?? null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Hard delete — removes storage files before deleting the DB row */
  delete: async (id: string) => {
    // 1. Clean up client-files storage
    const { data: clientFiles } = await supabase
      .from("client_files")
      .select("file_url")
      .eq("client_id", id);
    if (clientFiles && clientFiles.length > 0) {
      const paths = clientFiles
        .map((f: any) => f.file_url?.split("/client-files/")[1])
        .filter(Boolean);
      if (paths.length > 0) await supabase.storage.from("client-files").remove(paths);
    }

    // 2. Clean up project-receipts storage for all projects linked to this client
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", id);
    if (projects && projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const { data: receipts } = await supabase
        .from("project_receipts")
        .select("file_url")
        .in("project_id", projectIds)
        .not("file_url", "is", null);
      if (receipts && receipts.length > 0) {
        const paths = receipts
          .map((r: any) => r.file_url?.split("/project-receipts/")[1])
          .filter(Boolean);
        if (paths.length > 0) await supabase.storage.from("project-receipts").remove(paths);
      }
    }

    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },

  /** Move client to a different pipeline stage */
  updateStage: async (id: string, pipeline_stage_id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .update({ pipeline_stage_id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Assign a sales rep directly to a client (Prospect/Scheduled — no project yet) */
  assignSalesRep: async (id: string, sales_rep_id: string | null) => {
    const { error } = await supabase
      .from("clients")
      .update({ sales_rep_id })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
};
