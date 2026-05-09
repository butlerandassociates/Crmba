/**
 * Notifications API
 * Used for in-app bell notifications (e.g. crew pay submitted by PM).
 * recipient_id = specific person (per-user inbox)
 * recipient_id = NULL  = broadcast (admins only)
 */

import { supabase } from "@/lib/supabase";

export const notificationsAPI = {
  /** Fetch unread notifications for the current user.
   *  Admins see targeted + broadcast (recipient_id IS NULL).
   *  PM / Sales Rep / Foreman see ONLY notifications targeted directly at them. */
  getUnread: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    const query = supabase
      .from("notifications")
      .select("id, type, title, message, link, metadata, created_at, recipient_id")
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    const { data, error } = isAdmin
      ? await query.or(`recipient_id.eq.${user.id},recipient_id.is.null`)
      : await query.eq("recipient_id", user.id);

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Create a notification — pass recipient_id to target one person, omit for broadcast */
  create: async (payload: {
    type: string;
    title: string;
    message?: string;
    link?: string;
    metadata?: Record<string, unknown>;
    recipient_id?: string | null;
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

  /** Mark all unread notifications as read for the current user only */
  markAllRead: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    const query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    const { error } = isAdmin
      ? await query.or(`recipient_id.eq.${user.id},recipient_id.is.null`)
      : await query.eq("recipient_id", user.id);

    if (error) throw new Error(error.message);
  },
};
