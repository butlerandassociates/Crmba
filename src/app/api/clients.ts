/**
 * Clients API
 * CRUD + pipeline stage management for client records.
 */

import { supabase } from "@/lib/supabase";

export const clientsAPI = {
  /** List all active clients with lead source, pipeline stage, project total, and proposal forecast */
  getAll: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        *,
        lead_source:lead_sources(id, name),
        pipeline_stage:pipeline_stages(id, name, color, order_index),
        projects(total_value),
        estimates(id, total, status, created_at)
      `)
      .eq("is_discarded", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => {
      const project_total = (c.projects ?? []).reduce(
        (sum: number, p: any) => sum + (p.total_value ?? 0),
        0
      );
      const latestProposal = (c.estimates ?? [])
        .filter((e: any) => e.status !== "declined")
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        ...c,
        project_total,
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
      .select(`*, lead_source:lead_sources(id,name), pipeline_stage:pipeline_stages(id,name,color,order_index)`)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Create a new client (created_by auto-set from current session) */
  create: async (client: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...client, created_by: user?.id ?? null })
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
};
