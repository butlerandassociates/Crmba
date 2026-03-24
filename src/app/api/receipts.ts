/**
 * Project Receipts API
 * Upload receipt files and track actual project costs.
 */

import { supabase } from "@/lib/supabase";

export const receiptsAPI = {
  /** All receipts for a project */
  getByProject: async (project_id: string) => {
    const { data, error } = await supabase
      .from("project_receipts")
      .select("*")
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
