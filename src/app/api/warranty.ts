import { supabase } from "@/lib/supabase";

export type WarrantyItem = {
  id: string;
  section_id: string;
  scope_item: string;
  labor_text: string;
  material_note: string;
  sort_order: number;
};

export type WarrantySection = {
  id: string;
  title: string;
  sort_order: number;
  items: WarrantyItem[];
};

export const warrantyAPI = {
  getAll: async (): Promise<{ sections: WarrantySection[]; disclaimer: string }> => {
    const [sectionsRes, settingsRes] = await Promise.all([
      supabase.from("warranty_sections").select("*, items:warranty_items(*)").order("sort_order"),
      supabase.from("company_settings").select("warranty_disclaimer").limit(1).maybeSingle(),
    ]);
    if (sectionsRes.error) throw new Error(sectionsRes.error.message);
    const sections = (sectionsRes.data ?? []).map((s: any) => ({
      ...s,
      items: (s.items ?? []).sort((a: WarrantyItem, b: WarrantyItem) => a.sort_order - b.sort_order),
    }));
    return { sections, disclaimer: settingsRes.data?.warranty_disclaimer ?? "" };
  },

  createSection: async (title: string, sort_order: number): Promise<WarrantySection> => {
    const { data, error } = await supabase
      .from("warranty_sections").insert({ title, sort_order }).select().single();
    if (error) throw new Error(error.message);
    return { ...data, items: [] };
  },

  updateSection: async (id: string, title: string): Promise<void> => {
    const { error } = await supabase.from("warranty_sections").update({ title }).eq("id", id);
    if (error) throw new Error(error.message);
  },

  deleteSection: async (id: string): Promise<void> => {
    const { error } = await supabase.from("warranty_sections").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  createItem: async (item: Omit<WarrantyItem, "id">): Promise<WarrantyItem> => {
    const { data, error } = await supabase.from("warranty_items").insert(item).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateItem: async (id: string, patch: Partial<Pick<WarrantyItem, "scope_item" | "labor_text" | "material_note">>): Promise<void> => {
    const { error } = await supabase.from("warranty_items").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  },

  deleteItem: async (id: string): Promise<void> => {
    const { error } = await supabase.from("warranty_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  updateDisclaimer: async (text: string): Promise<void> => {
    const { data: row } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
    if (!row) return;
    const { error } = await supabase.from("company_settings").update({ warranty_disclaimer: text }).eq("id", row.id);
    if (error) throw new Error(error.message);
  },
};
