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
      .select(`*, category:service_categories(id, name)`)
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

  /** Create or update a product (upsert by id presence) */
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
