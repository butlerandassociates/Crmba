/**
 * Pipeline API
 * Manage pipeline stages and lead sources (admin configurable).
 */

import { supabase } from "@/lib/supabase";

export const pipelineStagesAPI = {
  /** All active pipeline stages in order */
  getAll: async () => {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("is_active", true)
      .order("order_index");
    if (error) throw new Error(error.message);
    return data;
  },

  create: async (stage: { name: string; order_index: number; color?: string }) => {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert(stage)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, stage: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .update(stage)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Soft-delete by deactivating */
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

export const leadSourcesAPI = {
  /** All active lead sources */
  getAll: async () => {
    const { data, error } = await supabase
      .from("lead_sources")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  create: async (name: string) => {
    const { data, error } = await supabase
      .from("lead_sources")
      .insert({ name })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, name: string) => {
    const { data, error } = await supabase
      .from("lead_sources")
      .update({ name })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Soft-delete by deactivating */
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from("lead_sources")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};
