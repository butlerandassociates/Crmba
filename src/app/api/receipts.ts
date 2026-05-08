/**
 * Project Receipts API
 * Upload receipt files and track actual project costs.
 */

import { supabase } from "@/lib/supabase";

export const receiptsAPI = {
  /** All receipts across all projects — for the Cost Attributions overview page */
  getAll: async () => {
    const [{ data: receipts, error: receiptsErr }, { data: labor, error: laborErr }] = await Promise.all([
      supabase
        .from("project_receipts")
        .select("*, project:projects(id, name, client_id, total_value, profit_margin, client:clients(id, first_name, last_name)), uploader:profiles!project_receipts_created_by_fkey(first_name, last_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("fio_crew_payments")
        .select("amount_paid, fio:field_installation_orders(project_id)"),
    ]);
    if (receiptsErr) throw new Error(receiptsErr.message);
    if (laborErr) throw new Error(laborErr.message);

    const laborByProject: Record<string, number> = {};
    for (const p of labor ?? []) {
      const pid = (p.fio as any)?.project_id;
      if (pid) laborByProject[pid] = (laborByProject[pid] || 0) + (Number(p.amount_paid) || 0);
    }

    const materialByProject: Record<string, number> = {};
    for (const r of receipts ?? []) {
      const pid = r.project?.id;
      if (pid) materialByProject[pid] = (materialByProject[pid] || 0) + (Number(r.amount) || 0);
    }

    return (receipts ?? []).map((r) => {
      const pid          = r.project?.id;
      const rev          = Number(r.project?.total_value) || 0;
      const mat          = pid ? (materialByProject[pid] || 0) : 0;
      const lab          = pid ? (laborByProject[pid] || 0) : 0;
      const gp_pct       = rev > 0 ? ((rev - mat - lab) / rev) * 100 : null;
      const projected_gp = r.project?.profit_margin ?? null;
      return { ...r, gp_pct, projected_gp };
    });
  },

  /** All receipts for a project */
  getByProject: async (project_id: string) => {
    const { data, error } = await supabase
      .from("project_receipts")
      .select("*, uploader:profiles!project_receipts_created_by_fkey(first_name, last_name)")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Add a receipt — optionally upload a file first */
  create: async (
    receipt: {
      project_id: string;
      name: string;
      amount: number;
      category: "material" | "labor";
      note?: string;
    },
    file?: File
  ) => {
    const { data: { user } } = await supabase.auth.getUser();

    let file_name: string | undefined;
    let file_url: string | undefined;

    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${receipt.project_id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("project-receipts")
        .upload(path, file);
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from("project-receipts")
        .getPublicUrl(path);

      file_name = file.name;
      file_url = publicUrl;
    }

    const { data, error } = await supabase
      .from("project_receipts")
      .insert({
        ...receipt,
        file_name,
        file_url,
        created_by: user?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete a receipt and its file from storage */
  delete: async (id: string, file_url?: string) => {
    if (file_url) {
      const path = file_url.split("/project-receipts/")[1];
      if (path) await supabase.storage.from("project-receipts").remove([path]);
    }
    const { error } = await supabase.from("project_receipts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};
