/**
 * API re-exports — backwards compatibility barrel.
 * All API modules live in src/app/api/
 * Components can import from here OR from "@/app/api" directly.
 */

export { clientsAPI }                                    from "../api/clients";
export { projectsAPI }                                   from "../api/projects";
export { appointmentsAPI }                               from "../api/appointments";
export { estimatesAPI }                                  from "../api/estimates";
export { usersAPI }                                      from "../api/team";
export { pipelineStagesAPI, leadSourcesAPI }             from "../api/pipeline";
export { productsAPI }                                   from "../api/products";
export { companySettingsAPI, emailTemplatesAPI, rolesAPI, permissionsAPI } from "../api/settings";
export { filesAPI, photosAPI }                           from "../api/files";
export { notesAPI, actionLogsAPI }                       from "../api/notes";

// Legacy migration helper (no-op — data already in Supabase)
import { supabase } from "@/lib/supabase";
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

// Dashboard stats (inline — not worth a separate file)
export const dashboardAPI = {
  getStats: async () => {
    const [drafts, sent, active, newLeads] = await Promise.all([
      supabase.from("estimates").select("total").in("status", ["draft", "saved"]),
      supabase.from("estimates").select("total").eq("status", "sent"),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_discarded", false).not("pipeline_stage_id", "is", null),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_discarded", false).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);
    return {
      draftEstimatesTotal: (drafts.data ?? []).reduce((s, e) => s + (e.total ?? 0), 0),
      sentEstimatesTotal:  (sent.data  ?? []).reduce((s, e) => s + (e.total ?? 0), 0),
      activeLeadsCount:    active.count   ?? 0,
      newLeadsThisMonth:   newLeads.count ?? 0,
    };
  },
};
