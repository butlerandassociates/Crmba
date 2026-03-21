/**
 * API Client — Supabase SDK
 * All CRM data operations using the Supabase JS client directly.
 */

import { supabase } from "@/lib/supabase";

// ──────────────────────────────────────────────────────────────
// Clients
// ──────────────────────────────────────────────────────────────

export const clientsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select(`*, lead_source:lead_sources(id,name), pipeline_stage:pipeline_stages(id,name,color,order_index)`)
      .eq("is_discarded", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  getDiscarded: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select(`*, lead_source:lead_sources(id,name), pipeline_stage:pipeline_stages(id,name,color)`)
      .eq("is_discarded", true)
      .order("discarded_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select(`*, lead_source:lead_sources(id,name), pipeline_stage:pipeline_stages(id,name,color,order_index)`)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  create: async (client: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...client, created_by: user?.id ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, client: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("clients")
      .update(client)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  discard: async (id: string, reason?: string) => {
    const { data, error } = await supabase
      .from("clients")
      .update({ is_discarded: true, discarded_at: new Date().toISOString(), discarded_reason: reason ?? null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  restore: async (id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .update({ is_discarded: false, discarded_at: null, discarded_reason: null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },

  updateStage: async (id: string, pipeline_stage_id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .update({ pipeline_stage_id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ──────────────────────────────────────────────────────────────
// Client Notes
// ──────────────────────────────────────────────────────────────

export const notesAPI = {
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("client_notes")
      .select(`*, profile:profiles(first_name, last_name)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

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

  delete: async (id: string) => {
    const { error } = await supabase.from("client_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};

// ──────────────────────────────────────────────────────────────
// Client Files
// ──────────────────────────────────────────────────────────────

export const filesAPI = {
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("client_files")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

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
        user_id: user?.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type,
        mime_type: file.type,
        file_size_bytes: file.size,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string, file_url: string) => {
    // Remove from storage
    const path = file_url.split("/client-files/")[1];
    if (path) {
      await supabase.storage.from("client-files").remove([path]);
    }
    const { error } = await supabase.from("client_files").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};

// ──────────────────────────────────────────────────────────────
// Appointments
// ──────────────────────────────────────────────────────────────

export const appointmentsAPI = {
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, profile:profiles!assigned_to(first_name, last_name)`)
      .eq("client_id", client_id)
      .order("appointment_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

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

  delete: async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};

// ──────────────────────────────────────────────────────────────
// Pipeline Stages (admin configurable)
// ──────────────────────────────────────────────────────────────

export const pipelineStagesAPI = {
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

// ──────────────────────────────────────────────────────────────
// Lead Sources (admin configurable)
// ──────────────────────────────────────────────────────────────

export const leadSourcesAPI = {
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

// ──────────────────────────────────────────────────────────────
// Products & Services (admin managed)
// ──────────────────────────────────────────────────────────────

export const productsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("products_services")
      .select(`*, category:service_categories(id, name)`)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  getCategories: async () => {
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  save: async (product: Record<string, unknown>) => {
    if (product.id) {
      const { id, ...rest } = product;
      const { data, error } = await supabase
        .from("products_services")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase
      .from("products_services")
      .insert(product)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  archive: async (id: string) => {
    const { data, error } = await supabase
      .from("products_services")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ──────────────────────────────────────────────────────────────
// Estimates
// ──────────────────────────────────────────────────────────────

export const estimatesAPI = {
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("estimates")
      .select(`*, line_items:estimate_line_items(*), payment_schedules(*)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("estimates")
      .select(`
        *,
        client:clients(first_name, last_name, email, phone, address, city, state, zip),
        line_items:estimate_line_items(*),
        payment_schedules(*)
      `)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("estimates")
      .select(`*, client:clients(first_name, last_name)`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  create: async (estimate: Record<string, unknown>, lineItems: Record<string, unknown>[], paymentSchedules: Record<string, unknown>[]) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Get next estimate number
    const { count } = await supabase
      .from("estimates")
      .select("*", { count: "exact", head: true });
    const estimateNumber = 1000 + (count ?? 0) + 1;

    const { data: est, error: estError } = await supabase
      .from("estimates")
      .insert({ ...estimate, created_by: user?.id, estimate_number: estimateNumber })
      .select()
      .single();
    if (estError) throw new Error(estError.message);

    if (lineItems.length > 0) {
      const { error: liError } = await supabase
        .from("estimate_line_items")
        .insert(lineItems.map((li) => ({ ...li, estimate_id: est.id })));
      if (liError) throw new Error(liError.message);
    }

    if (paymentSchedules.length > 0) {
      const { error: psError } = await supabase
        .from("payment_schedules")
        .insert(paymentSchedules.map((ps) => ({ ...ps, estimate_id: est.id })));
      if (psError) throw new Error(psError.message);
    }

    return est;
  },

  update: async (id: string, estimate: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("estimates")
      .update(estimate)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateStatus: async (id: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "sent") updates.sent_at = new Date().toISOString();
    if (status === "accepted") updates.accepted_at = new Date().toISOString();
    if (status === "declined") updates.declined_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("estimates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateLineItems: async (estimate_id: string, lineItems: Record<string, unknown>[]) => {
    await supabase.from("estimate_line_items").delete().eq("estimate_id", estimate_id);
    if (lineItems.length > 0) {
      const { error } = await supabase
        .from("estimate_line_items")
        .insert(lineItems.map((li) => ({ ...li, estimate_id })));
      if (error) throw new Error(error.message);
    }
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("estimates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};

// ──────────────────────────────────────────────────────────────
// Email Templates (admin managed)
// ──────────────────────────────────────────────────────────────

export const emailTemplatesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  save: async (template: Record<string, unknown>) => {
    if (template.id) {
      const { id, ...rest } = template;
      const { data, error } = await supabase
        .from("email_templates")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase
      .from("email_templates")
      .insert(template)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string) => {
    const { data, error } = await supabase
      .from("email_templates")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ──────────────────────────────────────────────────────────────
// Users / Team (admin managed)
// ──────────────────────────────────────────────────────────────

export const usersAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("first_name");
    if (error) throw new Error(error.message);
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, profile: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  create: async (profile: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .insert(profile)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  deactivate: async (id: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ──────────────────────────────────────────────────────────────
// Company Settings
// ──────────────────────────────────────────────────────────────

export const companySettingsAPI = {
  get: async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (settings: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("company_settings")
      .update(settings)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ──────────────────────────────────────────────────────────────
// Action Logs (audit trail)
// ──────────────────────────────────────────────────────────────

export const actionLogsAPI = {
  log: async (entry: {
    client_id?: string;
    action_type: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("action_logs").insert({ ...entry, user_id: user?.id });

    // Also create a system note on the client if client_id provided
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

// ──────────────────────────────────────────────────────────────
// Dashboard Stats
// ──────────────────────────────────────────────────────────────

export const dashboardAPI = {
  getStats: async () => {
    const [drafts, sent, active, newLeads] = await Promise.all([
      supabase
        .from("estimates")
        .select("total")
        .in("status", ["draft", "saved"]),
      supabase
        .from("estimates")
        .select("total")
        .eq("status", "sent"),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("is_discarded", false)
        .not("pipeline_stage_id", "is", null),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("is_discarded", false)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const draftTotal = (drafts.data ?? []).reduce((sum, e) => sum + (e.total ?? 0), 0);
    const sentTotal = (sent.data ?? []).reduce((sum, e) => sum + (e.total ?? 0), 0);

    return {
      draftEstimatesTotal: draftTotal,
      sentEstimatesTotal: sentTotal,
      activeLeadsCount: active.count ?? 0,
      newLeadsThisMonth: newLeads.count ?? 0,
    };
  },
};

// ──────────────────────────────────────────────────────────────
// Data Migration (legacy — no-op now that Supabase is live)
// ──────────────────────────────────────────────────────────────

export const migrateData = async (data: {
  clients?: Record<string, unknown>[];
  projects?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
}) => {
  const results: string[] = [];
  if (data.clients?.length) {
    const { error } = await supabase.from("clients").upsert(data.clients);
    results.push(error ? `clients: ${error.message}` : `clients: ${data.clients.length} imported`);
  }
  if (data.products?.length) {
    const { error } = await supabase.from("products_services").upsert(data.products);
    results.push(error ? `products: ${error.message}` : `products: ${data.products.length} imported`);
  }
  return { results };
};

// Keep legacy exports for backwards compatibility during transition
export const projectsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        client:clients(id, first_name, last_name, company),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name),
        foreman:profiles!projects_foreman_id_fkey(id, first_name, last_name)
      `)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Flatten + camelCase aliases for frontend compatibility
    return (data ?? []).map((p: any) => ({
      ...p,
      // camelCase aliases (frontend was built against mock-data camelCase)
      startDate: p.start_date ?? null,
      endDate: p.end_date ?? null,
      totalValue: Number(p.total_value ?? 0),
      totalCosts: Number(p.total_costs ?? 0),
      grossProfit: Number(p.gross_profit ?? 0),
      profitMargin: Number(p.profit_margin ?? 0),
      commission: Number(p.commission ?? 0),
      // joined names
      clientName: p.client
        ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() || p.client.company
        : "",
      projectManagerName: p.project_manager
        ? `${p.project_manager.first_name ?? ""} ${p.project_manager.last_name ?? ""}`.trim()
        : "",
      foremanName: p.foreman
        ? `${p.foreman.first_name ?? ""} ${p.foreman.last_name ?? ""}`.trim()
        : "",
    }));
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        client:clients(id, first_name, last_name, company, email, phone),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name),
        foreman:profiles!projects_foreman_id_fkey(id, first_name, last_name)
      `)
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    const p = data as any;
    return {
      ...p,
      startDate:          p.start_date ?? null,
      endDate:            p.end_date ?? null,
      totalValue:         Number(p.total_value    ?? 0),
      totalCosts:         Number(p.total_costs     ?? 0),
      grossProfit:        Number(p.gross_profit    ?? 0),
      profitMargin:       Number(p.profit_margin   ?? 0),
      commission:         Number(p.commission      ?? 0),
      commissionRate:     Number(p.commission_rate ?? 0),
      clientName: p.client
        ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() || p.client.company
        : "",
      projectManagerName: p.project_manager
        ? `${p.project_manager.first_name ?? ""} ${p.project_manager.last_name ?? ""}`.trim()
        : "",
      foremanName: p.foreman
        ? `${p.foreman.first_name ?? ""} ${p.foreman.last_name ?? ""}`.trim()
        : "",
    };
  },

  create: async (p: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("projects")
      .insert(p)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, p: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("projects")
      .update(p)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ──────────────────────────────────────────────────────────────
// Roles
// ──────────────────────────────────────────────────────────────
export const rolesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .eq("is_active", true)
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

// ──────────────────────────────────────────────────────────────
// Permissions
// ──────────────────────────────────────────────────────────────
export const permissionsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("category")
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  getDefaultsForRole: async (roleName: string) => {
    // Step 1: get role id
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();
    if (!role) return [];
    // Step 2: get permission keys for that role
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission:permissions(key)")
      .eq("role_id", role.id);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.permission?.key).filter(Boolean);
  },
};

export const photosAPI = {
  upload: async (clientId: string, file: File) => filesAPI.upload(clientId, file),
  getAll: async (clientId: string) => filesAPI.getByClient(clientId),
  delete: async (id: string, url: string) => filesAPI.delete(id, url),
};
