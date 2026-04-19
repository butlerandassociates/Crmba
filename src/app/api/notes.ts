/**
 * Notes & Action Logs API
 * Internal client notes and audit trail logging.
 */

import { supabase } from "@/lib/supabase";

export const notesAPI = {
  /** All notes for a client, newest first */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Add a note to a client */
  create: async (note: { client_id: string; content: string; is_system_generated?: boolean; action_type?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("client_notes")
      .insert({ ...note, user_id: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete a note */
  delete: async (id: string) => {
    const { error } = await supabase.from("client_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};

export const actionLogsAPI = {
  /** Log an action and optionally create a system note on the client */
  log: async (entry: {
    client_id?: string;
    action_type: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("action_logs").insert({ ...entry, user_id: user?.id });

    if (entry.client_id) {
      await supabase.from("client_notes").insert({
        client_id: entry.client_id,
        user_id: user?.id,
        content: entry.description,
        is_system_generated: true,
        action_type: entry.action_type,
      });
    }
  },

  /** Audit trail for a client */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("action_logs")
      .select(`*, profile:profiles(first_name, last_name)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
};
