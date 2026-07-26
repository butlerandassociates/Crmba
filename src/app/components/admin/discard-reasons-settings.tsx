import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { Plus, ChevronUp, ChevronDown, Pencil, Check, X, EyeOff, Eye } from "lucide-react";

interface DiscardReason {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  requires_note: boolean;
}

export function DiscardReasonsSettings() {
  const [reasons, setReasons] = useState<DiscardReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("discard_reasons")
      .select("*")
      .order("sort_order");
    setReasons(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = async (id: string, update: Partial<DiscardReason>) => {
    await supabase.from("discard_reasons").update(update).eq("id", id);
    await load();
  };

  const startEdit = (r: DiscardReason) => {
    setEditingId(r.id);
    setEditLabel(r.label);
  };

  const commitEdit = async (id: string) => {
    if (!editLabel.trim()) return;
    setSaving(true);
    await patch(id, { label: editLabel.trim() });
    setEditingId(null);
    setSaving(false);
    toast.success("Reason updated.");
  };

  const addReason = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    const maxOrder = reasons.length > 0 ? Math.max(...reasons.map((r) => r.sort_order)) : 0;
    await supabase.from("discard_reasons").insert({
      label: newLabel.trim(),
      sort_order: maxOrder + 1,
      is_active: true,
      requires_note: false,
    });
    setNewLabel("");
    await load();
    setSaving(false);
    toast.success("Reason added.");
  };

  const moveUp = async (r: DiscardReason, idx: number) => {
    if (idx === 0) return;
    const prev = reasons[idx - 1];
    await supabase.from("discard_reasons").update({ sort_order: r.sort_order }).eq("id", prev.id);
    await supabase.from("discard_reasons").update({ sort_order: prev.sort_order }).eq("id", r.id);
    await load();
  };

  const moveDown = async (r: DiscardReason, idx: number) => {
    if (idx === reasons.length - 1) return;
    const next = reasons[idx + 1];
    await supabase.from("discard_reasons").update({ sort_order: r.sort_order }).eq("id", next.id);
    await supabase.from("discard_reasons").update({ sort_order: next.sort_order }).eq("id", r.id);
    await load();
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Discard Reasons</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reasons available when discarding a client. Removed reasons stay in history but won't appear on new discards.
          Toggle <strong>Req. note</strong> to force the rep to type an explanation for that reason.
        </p>
      </div>

      <div className="border rounded-lg divide-y">
        {reasons.map((r, idx) => (
          <div
            key={r.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${!r.is_active ? "opacity-40" : ""}`}
          >
            {/* Reorder arrows */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => moveUp(r, idx)}
                disabled={idx === 0}
                className="p-0.5 rounded hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => moveDown(r, idx)}
                disabled={idx === reasons.length - 1}
                className="p-0.5 rounded hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            {/* Label / inline edit */}
            <div className="flex-1 min-w-0">
              {editingId === r.id ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(r.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => commitEdit(r.id)}
                    disabled={saving}
                    className="p-1 rounded hover:bg-accent text-green-600 shrink-0"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-sm truncate block">{r.label}</span>
              )}
            </div>

            {/* Req. note toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:block">Req. note</span>
              <Switch
                checked={r.requires_note}
                onCheckedChange={(v) => patch(r.id, { requires_note: v })}
              />
            </div>

            {/* Rename */}
            {editingId !== r.id && (
              <button
                onClick={() => startEdit(r)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground shrink-0"
                title="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Soft-delete / restore */}
            <button
              onClick={() => patch(r.id, { is_active: !r.is_active })}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground shrink-0"
              title={r.is_active ? "Remove (soft)" : "Restore"}
            >
              {r.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}

        {reasons.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No reasons yet. Add one below.</div>
        )}
      </div>

      {/* Add new reason */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="New reason label…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") addReason(); }}
        />
        <Button size="sm" onClick={addReason} disabled={!newLabel.trim() || saving}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
