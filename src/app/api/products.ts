/**
 * Products & Services API
 * Manage the product/service catalog used in estimates.
 */

import { supabase } from "@/lib/supabase";

export const productsAPI = {
  /** All active products with their service category */
  getAll: async () => {
    const { data, error } = await supabase
      .from("products_services")
      .select(`*, category:service_categories(id, name), supplier:suppliers(id, supplier_name, poc_name, email)`)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  /** All active service categories */
  getCategories: async () => {
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  createCategory: async (name: string) => {
    const { data, error } = await supabase
      .from("service_categories")
      .insert({ name })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateCategory: async (id: string, name: string) => {
    const { data, error } = await supabase
      .from("service_categories")
      .update({ name })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  deleteCategory: async (id: string) => {
    const { error } = await supabase
      .from("service_categories")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  /** All units from the units table */
  getUnits: async () => {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Create or update a product (upsert by id presence).
   *  On update: cascades name + description changes to estimate_line_items
   *  for proposals where the client is NOT active or completed (no signed contract). */
  save: async (product: Record<string, unknown>) => {
    if (product.id) {
      const { id, ...rest } = product;

      // Fetch old name before update so we can match existing line items by it
      let oldName: string | null = null;
      if (rest.name !== undefined || rest.description !== undefined) {
        const { data: existing } = await supabase
          .from("products_services").select("name").eq("id", id).single();
        oldName = existing?.name ?? null;
      }

      const { data, error } = await supabase
        .from("products_services")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Cascade name + description to open proposals only.
      // Frozen if: client is active/completed/sold OR proposal itself is accepted.
      if (oldName && (rest.name !== undefined || rest.description !== undefined)) {
        const lineItemUpdate: Record<string, unknown> = {};
        if (rest.name !== undefined) lineItemUpdate.product_name = rest.name;
        if (rest.description !== undefined) lineItemUpdate.description = rest.description;

        const { data: allEstimates } = await supabase
          .from("estimates")
          .select("id, status, clients!estimates_client_id_fkey(status)");

        const eligibleIds = (allEstimates ?? [])
          .filter((e: any) =>
            !["active", "completed", "sold"].includes(e.clients?.status) &&
            e.status !== "accepted"
          )
          .map((e: any) => e.id);

        if (eligibleIds.length > 0) {
          await supabase
            .from("estimate_line_items")
            .update(lineItemUpdate)
            .eq("product_name", oldName)
            .in("estimate_id", eligibleIds);
        }
      }

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

  /** Soft-delete by archiving */
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
