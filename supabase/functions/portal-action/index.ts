import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://crm.butlerconstruction.co","https://client.butlerconstruction.co","http://localhost:5173","https://controller.butlerconstruction.co"];

const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const { token, action, entity_id, comment } = await req.json();

    console.log(`[portal-action] action=${action} entity_id=${entity_id} token=...${token?.slice(-8)}`);

    if (!token || !action || !entity_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token and get client_id
    const { data: tokenRow } = await supabase
      .from("client_portal_tokens")
      .select("client_id, is_active")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow || !tokenRow.is_active) {
      return new Response(JSON.stringify({ success: false, error: "Invalid or revoked token" }), {
        status: 401,
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    const clientId = tokenRow.client_id;

    if (action === "proposal_opened") {
      // Mark proposal as opened the first time a client views it via the portal
      const { data: proposal } = await supabase
        .from("estimates")
        .select("id, client_id, status, title")
        .eq("id", entity_id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!proposal || proposal.status !== "sent") {
        // Silently succeed — already opened/accepted/declined or not found
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...cors(req), "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("estimates")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", entity_id);

      const { data: clientRow } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
      const clientName = clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : "Client";

      await supabase.from("notifications").insert({
        type: "proposal_opened",
        title: "Proposal Opened",
        message: `${clientName} opened the proposal${proposal.title ? ` "${proposal.title}"` : ""}`,
        link: `/clients/${clientId}`,
        is_read: false,
      }).then(() => {});

      await supabase.from("activity_log").insert({
        client_id: clientId,
        action_type: "proposal_viewed",
        description: `Client opened proposal${proposal.title ? `: "${proposal.title}"` : ""}`,
      }).then(() => {});

      console.log(`[portal-action] SUCCESS: proposal_opened entity_id=${entity_id} client_id=${clientId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    if (action === "co_opened") {
      // Mark CO as opened the first time a client views it
      const { data: co } = await supabase
        .from("change_orders")
        .select("id, client_id, status, title")
        .eq("id", entity_id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!co || co.status !== "pending_client") {
        // Silently succeed — either not found or already past pending (e.g. already opened/approved/rejected)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...cors(req), "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("change_orders")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", entity_id);

      const { data: clientRow } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
      const clientName = clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : "Client";

      await supabase.from("notifications").insert({
        type: "co_opened",
        title: "Change Order Opened",
        message: `${clientName} opened the change order${co.title ? ` "${co.title}"` : ""}`,
        link: `/clients/${clientId}`,
        is_read: false,
      }).then(() => {});

      await supabase.from("activity_log").insert({
        client_id: clientId,
        action_type: "co_viewed",
        description: `Client opened change order${co.title ? `: "${co.title}"` : ""}`,
      }).then(() => {});

      console.log(`[portal-action] SUCCESS: co_opened entity_id=${entity_id} client_id=${clientId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    if (action === "co_approve" || action === "co_reject") {
      // Verify this CO belongs to this client
      const { data: co } = await supabase
        .from("change_orders")
        .select("id, client_id, status")
        .eq("id", entity_id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!co) {
        return new Response(JSON.stringify({ success: false, error: "Change order not found" }), {
          status: 404,
          headers: { ...cors(req), "Content-Type": "application/json" },
        });
      }

      if (co.status !== "pending_client" && co.status !== "opened") {
        return new Response(JSON.stringify({ success: false, error: "Change order is not pending client action" }), {
          status: 400,
          headers: { ...cors(req), "Content-Type": "application/json" },
        });
      }

      const newStatus = action === "co_approve" ? "approved" : "rejected";
      await supabase
        .from("change_orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", entity_id);

      const { data: clientRow } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
      const clientName = clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : "Client";
      const actionLabel = action === "co_approve" ? "approved" : "declined";
      const coActionType = action === "co_approve" ? "change_order_approved" : "change_order_rejected";
      const coDescription = action === "co_approve"
        ? "Client approved change order via portal"
        : `Client declined change order via portal${comment ? ": " + comment : ""}`;

      // Log activity
      await supabase.from("activity_log").insert({
        client_id: clientId,
        action_type: coActionType,
        description: coDescription,
      }).then(() => {});

      // Bell notification
      await supabase.from("notifications").insert({
        type: coActionType,
        title: `Change Order ${action === "co_approve" ? "Approved" : "Declined"}`,
        message: `${clientName} has ${actionLabel} a change order via the client portal.${comment ? ` — "${comment}"` : ""}`,
        metadata: { client_id: clientId },
        link: `/clients/${clientId}`,
        is_read: false,
      }).then(() => {});

      // Notify admin + PM via email
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({
          to: "info@butlerconstruction.co",
          subject: `Change order ${actionLabel} by ${clientName}`,
          html: `<p>${clientName} has <strong>${actionLabel}</strong> a change order via the client portal.</p>${comment ? `<p><em>Comment: ${comment}</em></p>` : ""}`,
        }),
      }).catch(() => {});

      // On rejection: SMS alert to admin + PM phones
      if (action === "co_reject") {
        const smsBody = `Butler & Associates: ${clientName} declined a change order via the portal.${comment ? ` Reason: ${comment}` : ""} Log in to review.`;
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
        if (twilioSid && twilioToken && twilioFrom) {
          const creds = btoa(`${twilioSid}:${twilioToken}`);
          // Fetch admin + PM phones from profiles
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("phone, role")
            .in("role", ["admin"]);
          // Also fetch PM phone from the active project
          const { data: proj } = await supabase
            .from("projects")
            .select("project_manager_id")
            .eq("client_id", clientId)
            .eq("portal_enabled", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const pmPhones: string[] = [];
          if (proj?.project_manager_id) {
            const { data: pmProfile } = await supabase
              .from("profiles")
              .select("phone")
              .eq("id", proj.project_manager_id)
              .maybeSingle();
            if (pmProfile?.phone) pmPhones.push(pmProfile.phone);
          }
          const adminPhones = (adminProfiles ?? []).map((p: any) => p.phone).filter(Boolean);
          const allPhones = [...new Set([...adminPhones, ...pmPhones])];
          for (const phone of allPhones) {
            const digits = phone.replace(/\D/g, "");
            const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
            if (!e164) continue;
            const form = new URLSearchParams({ To: e164, From: twilioFrom, Body: smsBody });
            fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
              method: "POST",
              headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: form.toString(),
            }).catch(() => {});
          }
        }
      }

      console.log(`[portal-action] SUCCESS: ${action} co ${entity_id} client_id=${clientId} new_status=${newStatus}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    if (action === "proposal_accept" || action === "proposal_decline") {
      // Verify this proposal belongs to this client
      const { data: proposal } = await supabase
        .from("estimates")
        .select("id, client_id, status")
        .eq("id", entity_id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!proposal) {
        return new Response(JSON.stringify({ success: false, error: "Proposal not found" }), {
          status: 404,
          headers: { ...cors(req), "Content-Type": "application/json" },
        });
      }

      if (proposal.status !== "sent" && proposal.status !== "opened") {
        return new Response(JSON.stringify({ success: false, error: "Proposal is not in sent status" }), {
          status: 400,
          headers: { ...cors(req), "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();
      if (action === "proposal_accept") {
        await supabase
          .from("estimates")
          .update({ status: "accepted", accepted_at: now, updated_at: now })
          .eq("id", entity_id);
      } else {
        await supabase
          .from("estimates")
          .update({ status: "declined", declined_at: now, updated_at: now })
          .eq("id", entity_id);
      }

      const { data: clientRow2 } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
      const clientName2 = clientRow2 ? `${clientRow2.first_name} ${clientRow2.last_name}` : "Client";
      const actionLabel2 = action === "proposal_accept" ? "accepted" : "declined";
      const propActionType = action === "proposal_accept" ? "proposal_accepted" : "proposal_declined";
      const propDescription = action === "proposal_accept"
        ? "Client accepted proposal via portal"
        : `Client declined proposal via portal${comment ? ": " + comment : ""}`;

      // Log activity
      await supabase.from("activity_log").insert({
        client_id: clientId,
        action_type: propActionType,
        description: propDescription,
      }).then(() => {});

      // Bell notification
      await supabase.from("notifications").insert({
        type: propActionType,
        title: `Proposal ${action === "proposal_accept" ? "Accepted" : "Declined"}`,
        message: `${clientName2} has ${actionLabel2} a proposal via the client portal.${comment ? ` — "${comment}"` : ""}`,
        metadata: { client_id: clientId },
        link: `/clients/${clientId}`,
        is_read: false,
      }).then(() => {});

      // Notify admin + PM via email
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({
          to: "info@butlerconstruction.co",
          subject: `Proposal ${actionLabel2} by ${clientName2}`,
          html: `<p>${clientName2} has <strong>${actionLabel2}</strong> a proposal via the client portal.</p>${comment ? `<p><em>Comment: ${comment}</em></p>` : ""}`,
        }),
      }).catch(() => {});

      console.log(`[portal-action] SUCCESS: ${action} proposal ${entity_id} client_id=${clientId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
      status: 400,
      headers: { ...cors(req), "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[portal-action] Error:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...cors(req), "Content-Type": "application/json" },
    });
  }
});
