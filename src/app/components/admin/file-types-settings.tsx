import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { Plus, ChevronUp, ChevronDown, Pencil, Check, X, EyeOff, Eye, Lock } from "lucide-react";
import { fileTypesAPI, type FileType } from "../../api/file-types";

// Admin portal → "File Types": the names people pick from when they upload a file on a client's
// Notes & Files card (Jonathan, Oct 20 2026). Same pattern as Discard Reasons.
export function FileTypesSettings() {
  const [types, setTypes] = useState<FileType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setTypes(await fileTypesAPI.getAll());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<void>, okMsg?: string) => {
    setSaving(true);
    try {
      await fn();
      await load();
      if (okMsg) toast.success(okMsg);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const commitEdit = (key: string) => {
    const label = editLabel.trim();
    if (!label) { toast.error("Enter a name for the file type."); return; }
    if (types.some((t) => t.key !== key && t.label.trim().toLowerCase() === label.toLowerCase())) {
      toast.error("A file type with that name already exists.");
      return;
    }
    run(async () => { await fileTypesAPI.update(key, { label }); setEditingKey(null); }, "File type renamed.");
  };

  const add = () => {
    if (!newLabel.trim()) { toast.error("Enter a name for the file type."); return; }
    run(async () => { await fileTypesAPI.create(newLabel, types); setNewLabel(""); }, "File type added.");
  };

  // swap sort_order with the neighbour (same approach as Discard Reasons)
  const move = (idx: number, dir: -1 | 1) => {
    const a = types[idx], b = types[idx + dir];
    if (!a || !b) return;
    run(async () => {
      // equal sort_orders would make the swap a no-op, so fall back to the row positions
      const aOrder = a.sort_order === b.sort_order ? (dir === -1 ? b.sort_order : b.sort_order + 1) : b.sort_order;
      const bOrder = a.sort_order === b.sort_order ? (dir === -1 ? a.sort_order + 1 : a.sort_order) : a.sort_order;
      await fileTypesAPI.update(a.key, { sort_order: aOrder });
      await fileTypesAPI.update(b.key, { sort_order: bOrder });
    });
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (loadError) return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      Couldn't load file types. If this is the first time, the database update for file types still needs to be applied.
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">File Types</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          The names offered when someone uploads a file on a client's Notes &amp; Files card. Hidden types stay on the files that already use them but
          won't be offered for new uploads. Types with a <Lock className="inline h-3 w-3 -mt-0.5" /> are used by other parts of the CRM (for example the
          completion checklist), so they can be renamed but not hidden.
        </p>
      </div>

      <div className="border rounded-lg divide-y">
        {types.map((t, idx) => (
          <div key={t.key} className={`flex items-center gap-3 px-4 py-2.5 ${!t.is_active ? "opacity-50" : ""}`}>
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => move(idx, -1)} disabled={idx === 0 || saving} className="p-0.5 rounded hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed" aria-label="Move up">
                <ChevronUp className="h-3 w-3" />
              </button>
              <button onClick={() => move(idx, 1)} disabled={idx === types.length - 1 || saving} className="p-0.5 rounded hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed" aria-label="Move down">
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              {editingKey === t.key ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(t.key); if (e.key === "Escape") setEditingKey(null); }}
                    className="h-8 text-sm"
                    autoFocus
                    maxLength={60}
                  />
                  <Button size="sm" className="h-8 w-8 p-0" onClick={() => commitEdit(t.key)} disabled={saving} aria-label="Save"><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingKey(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{t.label}</span>
                  {t.is_system && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Used by other parts of the CRM" />}
                  {!t.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Hidden</span>}
                </div>
              )}
            </div>

            {editingKey !== t.key && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingKey(t.key); setEditLabel(t.label); }}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  aria-label={`Rename ${t.label}`}
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!t.is_system && (
                  <button
                    onClick={() => run(() => fileTypesAPI.update(t.key, { is_active: !t.is_active }), t.is_active ? "File type hidden." : "File type shown.")}
                    disabled={saving}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    aria-label={t.is_active ? `Hide ${t.label}` : `Show ${t.label}`}
                    title={t.is_active ? "Hide from new uploads" : "Show again"}
                  >
                    {t.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="New file type, e.g. Site Plan"
          className="h-9 text-sm max-w-xs"
          maxLength={60}
        />
        <Button size="sm" onClick={add} disabled={saving}>
          <Plus className="h-4 w-4 mr-1" />Add file type
        </Button>
      </div>
    </div>
  );
}
