import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, ip, ua } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token and get client_id
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("client_portal_tokens")
      .select("id, client_id, is_active, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr) {
      console.error("[portal-token] DB error:", tokenErr.message);
      return new Response(JSON.stringify({ valid: false, error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokenRow || !tokenRow.is_active) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid or revoked token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = tokenRow.client_id;

    // Record access — fire and forget, errors non-fatal
    supabase.rpc("record_portal_access", {
      p_token: token,
      p_ip: ip ?? "unknown",
      p_ua: ua ?? "unknown",
    }).then(({ error }) => {
      if (error) console.warn("[portal-token] record_portal_access failed:", error.message);
    });

    // Log portal view once per day — skip if already logged in last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("activity_log")
      .select("id")
      .eq("client_id", clientId)
      .eq("action_type", "portal_viewed")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => {
        if (!data) {
          supabase.from("activity_log").insert({
            client_id: clientId,
            action_type: "portal_viewed",
            description: "Client opened the client portal",
          }).then(() => {});
        }
      });

    // Fetch client + payments + files + change_orders + proposals in parallel
    const [clientRes, projectRes, paymentsRes, filesRes, changeOrdersRes, proposalsRes, priorPortalViewRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, first_name, last_name, phone, email, address, city, state, zip")
        .eq("id", clientId)
        .single(),

      supabase
        .from("projects")
        .select(`
          id, total_value, start_date, end_date, target_date,
          project_type, days_total, portal_enabled,
          project_manager:profiles!projects_project_manager_id_fkey(first_name, last_name, phone)
        `)
        .eq("client_id", clientId)
        .eq("portal_enabled", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("project_payments")
        .select("id, label, amount, is_paid, due_date, paid_date, payment_method, confirmation_code, breakdown, sort_order, percentage, notes, stripe_fee_amount")
        .eq("client_id", clientId)
        .order("sort_order", { ascending: true, nullsFirst: false }),

      supabase
        .from("client_files")
        .select("id, file_name, file_url, file_type, created_at, file_size_bytes")
        .eq("client_id", clientId)
        // Subcontractor Agreement is an internal Butler↔foreman doc — never expose it to the client portal
        .neq("file_type", "subcontractor")
        .order("created_at", { ascending: false }),

      supabase
        .from("change_orders")
        .select(`
          id, title, reason, timeline_impact, cost_impact, status, created_at,
          approval_verified, approval_file_url, approval_file_name, pdf_url,
          original_total, new_total, modifications,
          items:change_order_items!change_order_items_co_id_fkey(id, description, quantity, unit, unit_price, total, category, sort_order)
        `)
        .eq("client_id", clientId)
        .in("status", ["pending_client", "opened", "approved", "merged"])
        .order("created_at", { ascending: false }),

      supabase
        .from("estimates")
        .select(`
          id, title, status, subtotal, tax_rate, tax_amount, total, sent_at, accepted_at, declined_at, pdf_url,
          line_items:estimate_line_items(id, name, description, quantity, unit, client_price, sort_order)
        `)
        .eq("client_id", clientId)
        .in("status", ["sent", "opened", "accepted"])
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("activity_log")
        .select("id")
        .eq("client_id", clientId)
        .eq("action_type", "portal_viewed")
        .limit(1)
        .maybeSingle(),
    ]);

    if (clientRes.error) throw new Error("Client not found: " + clientRes.error.message);
    const client = clientRes.data;
    const project = projectRes.data ?? null;

    // Notify admin on first-ever portal open
    if (!priorPortalViewRes.data) {
      const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
      supabase.from("notifications").insert({
        type: "portal_first_opened",
        title: "Client Opened Portal",
        message: `${fullName} opened their client portal for the first time`,
        link: `/clients/${clientId}`,
      }).then(() => {});
    }

    // If project has no PM, fall back to first admin (Jonathan)
    if (project && !project.project_manager) {
      const { data: defaultPm } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (defaultPm) {
        (project as any).project_manager = defaultPm;
      }
    }

    // Phases + updates — need project_id
    let phases: any[] = [];
    let updates: any[] = [];

    if (project) {
      const [phasesResult, updatesResult] = await Promise.all([
        supabase
          .from("project_phases")
          .select(`
            id, label, order_index, status, progress_pct, expected_date, completed_date,
            tasks:phase_task_completions(id, task_label, order_index, is_completed, photo_required, note_required, photo_url, photo_approval_status, note)
          `)
          .eq("project_id", project.id)
          .eq("is_active", true)
          .order("order_index", { ascending: true }),

        supabase
          .from("portal_updates")
          .select(`
            id, title, body, completed_items, upcoming_items, posted_at, phase_id,
            phase:project_phases!portal_updates_phase_id_fkey(id, label),
            posted_by_profile:profiles!portal_updates_posted_by_fkey(first_name, last_name),
            photos:portal_update_photos(id, public_url, label, order_index, approval_status, is_marketing_flagged)
          `)
          .eq("project_id", project.id)
          .eq("is_visible", true)
          .eq("is_active", true)
          .order("posted_at", { ascending: false }),
      ]);

      phases = (phasesResult.data ?? []).map((p: any) => ({
        ...p,
        tasks: [...(p.tasks ?? [])].sort((a: any, b: any) => a.order_index - b.order_index).map((t: any) => ({
          ...t,
          photo_url: t.photo_approval_status === "approved" ? t.photo_url : null,
        })),
      }));
      updates = (updatesResult.data ?? []).map((u: any) => ({
        ...u,
        phase_label: u.phase?.label ?? null,
        photos: (u.photos ?? [])
          .filter((p: any) => p.approval_status === "approved" && !p.is_marketing_flagged)
          .sort((a: any, b: any) => a.order_index - b.order_index),
      }));
    }

    const payments = (paymentsRes.data ?? []).map((p: any) => ({
      ...p,
      amount: Number(p.amount ?? 0),
      percentage: p.percentage != null ? Number(p.percentage) : null,
    }));

    const files = filesRes.data ?? [];

    if (changeOrdersRes.error) console.error("[portal-token] change_orders error:", changeOrdersRes.error.message);
    if (proposalsRes.error) console.error("[portal-token] proposals error:", proposalsRes.error.message);

    // Collect all estimate_item_ids referenced in modifications across all COs
    const allModItemIds: string[] = [];
    for (const co of (changeOrdersRes.data ?? [])) {
      const mods: any[] = Array.isArray(co.modifications) ? co.modifications : [];
      for (const m of mods) {
        if (m.estimate_item_id) allModItemIds.push(m.estimate_item_id);
      }
    }

    // Fetch name, category, unit for modified items (deduplicated)
    const uniqueIds = [...new Set(allModItemIds)];
    const modItemData: Record<string, { name: string; category: string | null; unit: string | null }> = {};
    if (uniqueIds.length > 0) {
      const { data: liRows } = await supabase
        .from("estimate_line_items")
        .select("id, name, category, unit")
        .in("id", uniqueIds);
      for (const row of (liRows ?? [])) {
        modItemData[row.id] = { name: row.name, category: row.category ?? null, unit: row.unit ?? null };
      }
    }

    const change_orders = (changeOrdersRes.data ?? []).map((co: any) => {
      const mods: any[] = Array.isArray(co.modifications) ? co.modifications : [];
      const modifications_display = mods.map((m: any) => {
        const itemMeta = modItemData[m.estimate_item_id];
        return {
          name: itemMeta?.name ?? "Existing item",
          action: m.action,
          category: itemMeta?.category ?? null,
          unit: itemMeta?.unit ?? null,
          quantity: m.action === "delete" ? Number(m.original_quantity ?? 0) : Number(m.quantity ?? 0),
          unit_price: m.action === "delete" ? Number(m.original_client_price ?? 0) : Number(m.client_price ?? 0),
          delta: m.action === "delete"
            ? -Number(m.original_total ?? 0)
            : Number(m.total_price ?? 0) - Number(m.original_total ?? 0),
        };
      });
      const { modifications: _mods, ...coRest } = co;
      return {
        ...coRest,
        cost_impact: Number(co.cost_impact ?? 0),
        original_total: co.original_total != null ? Number(co.original_total) : null,
        new_total: co.new_total != null ? Number(co.new_total) : null,
        items: (co.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        modifications_display,
      };
    });

    const proposals = (proposalsRes.data ?? []).map((p: any) => ({
      ...p,
      subtotal: Number(p.subtotal ?? 0),
      tax_amount: Number(p.tax_amount ?? 0),
      total: Number(p.total ?? 0),
      line_items: (p.line_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    }));

    return new Response(
      JSON.stringify({ valid: true, client, project, phases, payments, updates, files, change_orders, proposals }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[portal-token] Unhandled exception:", err.message);
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
