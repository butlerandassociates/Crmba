/**
 * Notifications API
 * Used for in-app bell notifications (e.g. crew pay submitted by PM).
 */

import { supabase } from "@/lib/supabase";

export const notificationsAPI = {
  /** Fetch all unread notifications */
  getUnread: async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*, created_by_profile:profiles!notifications_created_by_fkey(first_name, last_name)")
      .eq("is_read", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Create a notification */
  create: async (payload: {
    type: string;
    title: string;
    message?: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("notifications").insert({
      ...payload,
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
  },

  /** Mark a single notification as read */
  markRead: async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  /** Mark all notifications as read */
  markAllRead: async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    if (error) throw new Error(error.message);
  },
};
