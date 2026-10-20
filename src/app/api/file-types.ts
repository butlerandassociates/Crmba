/**
 * File types for the client Notes & Files card (Jonathan, Oct 20 2026) — managed in the admin portal.
 * client_files.file_type stores the short `key`; the label is what people see.
 */
import { supabase } from "@/lib/supabase";

export type FileType = {
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
};

// What the dropdown offered before file types became editable. Used if the table can't be read (e.g. before
// the migration has run) so uploads keep working with the same choices.
export const FALLBACK_FILE_TYPES: FileType[] = [
  { key: "contract",      label: "Contract",                  sort_order: 10,  is_active: true, is_system: true },
  { key: "proposal",      label: "Proposal",                  sort_order: 20,  is_active: true, is_system: false },
  { key: "receipt",       label: "Receipt",                   sort_order: 30,  is_active: true, is_system: false },
  { key: "photo",         label: "Site Photo",                sort_order: 50,  is_active: true, is_system: true },
  { key: "certificate",   label: "Certificate of Completion", sort_order: 60,  is_active: true, is_system: true },
  { key: "subcontractor", label: "Subcontractor Agreement",   sort_order: 70,  is_active: true, is_system: true },
  { key: "insurance",     label: "Insurance",                 sort_order: 80,  is_active: true, is_system: false },
  { key: "other",         label: "Other",                     sort_order: 999, is_active: true, is_system: true },
];

/** "Site Plan / Permit" -> "site_plan_permit" (lowercase, a-z 0-9 and underscores only) */
export function slugifyFileTypeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Label for a stored key — falls back to a tidy version of the key for types that no longer exist. */
export function fileTypeLabel(types: FileType[], key: string | null | undefined): string {
  if (!key) return "";
  const hit = types.find((t) => t.key === key);
  if (hit) return hit.label;
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

export const fileTypesAPI = {
  getAll: async (): Promise<FileType[]> => {
    const { data, error } = await supabase.from("file_types").select("*").order("sort_order").order("label");
    if (error) throw new Error(error.message);
    return (data ?? []) as FileType[];
  },

  create: async (label: string, existing: FileType[]): Promise<FileType> => {
    const trimmed = label.trim();
    let key = slugifyFileTypeKey(trimmed);
    if (!key) throw new Error("Enter a name for the file type.");
    if (existing.some((t) => t.label.trim().toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("A file type with that name already exists.");
    }
    // keys must stay unique even when two different names slug to the same thing
    const base = key;
    let n = 2;
    while (existing.some((t) => t.key === key)) key = `${base}_${n++}`;
    const sort_order = Math.max(0, ...existing.filter((t) => t.key !== "other").map((t) => t.sort_order)) + 10;
    const { data, error } = await supabase
      .from("file_types")
      .insert({ key, label: trimmed, sort_order, is_active: true, is_system: false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as FileType;
  },

  update: async (key: string, patch: Partial<Pick<FileType, "label" | "is_active" | "sort_order">>) => {
    const { error } = await supabase.from("file_types").update(patch).eq("key", key);
    if (error) throw new Error(error.message);
  },
};
