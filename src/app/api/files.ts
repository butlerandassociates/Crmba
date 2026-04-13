/**
 * Files & Photos API
 * Upload, list, and delete client files from Supabase Storage.
 */

import { supabase } from "@/lib/supabase";

export const filesAPI = {
  /** All files attached to a client */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("client_files")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Upload a file to storage and record it in the DB */
  upload: async (client_id: string, file: File, file_type = "other") => {
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop();
    const path = `${client_id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("client-files")
      .upload(path, file);
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from("client-files")
      .getPublicUrl(path);

    const { data, error } = await supabase
      .from("client_files")
      .insert({
        client_id,
        user_id:        user?.id,
        file_name:      file.name,
        file_url:       publicUrl,
        file_type,
        mime_type:      file.type,
        file_size_bytes: file.size,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Remove from storage and delete DB record */
  delete: async (id: string, file_url: string) => {
    const path = file_url.split("/client-files/")[1];
    if (path) await supabase.storage.from("client-files").remove([path]);
    const { error } = await supabase.from("client_files").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};

/** Alias used by client-detail page for photo uploads */
export const photosAPI = {
  upload: (clientId: string, file: File, file_type = "other") => filesAPI.upload(clientId, file, file_type),
  getAll: (clientId: string)            => filesAPI.getByClient(clientId),
  delete: (id: string, url: string)     => filesAPI.delete(id, url),
};
