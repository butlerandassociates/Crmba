/**
 * Appointments API
 * Schedule, track, and mark meetings with clients.
 */

import { supabase } from "@/lib/supabase";

export const appointmentsAPI = {
  /** All appointments for a client, newest first */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, assigned_to_profile:profiles!assigned_to(first_name, last_name)`)
      .eq("client_id", client_id)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Create a new appointment record */
  create: async (appointment: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("appointments")
      .insert({ ...appointment, created_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update appointment fields */
  update: async (id: string, appointment: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("appointments")
      .update(appointment)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Mark an appointment as completed/met */
  markAsMet: async (id: string) => {
    const { data, error } = await supabase
      .from("appointments")
      .update({ is_met: true, met_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete an appointment */
  delete: async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};
