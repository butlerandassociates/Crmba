import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../ui/dialog";
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  CheckCircle2, Circle, Clock, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Phase {
  id: string;
  label: string;
  order_index: number;
  status: "upcoming" | "in-progress" | "complete";
  progress_pct: number;
  expected_date: string | null;
  completed_date: string | null;
}

interface Props {
  projectId: string;
}

export function PortalPhases({ projectId }: Props) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [initing, setIniting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_phases")
      .select("id, label, order_index, status, progress_pct, expected_date, completed_date")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    if (error) toast.error("Failed to load phases");
    else setPhases(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleInitDefaults = async () => {
    setIniting(true);
    const { error } = await supabase.rpc("init_project_phases", { p_project_id: projectId });
    if (error) toast.error("Failed to initialize: " + error.message);
    else { toast.success("Default phases initialized!"); await load(); }
    setIniting(false);
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setAdding(true);
    const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.order_index)) + 1 : 0;
    const { error } = await supabase
      .from("project_phases")
      .insert({ project_id: projectId, label: newLabel.trim(), order_index: maxOrder });
    if (error) toast.error("Failed to add phase");
    else { toast.success("Phase added"); setNewLabel(""); setShowAdd(false); await load(); }
    setAdding(false);
  };

  const handleUpdate = async (id: string, updates: Partial<Omit<Phase, "id">>) => {
    setSaving(id);
    const { error } = await supabase
      .from("project_phases")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Failed to update phase");
    else setPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from("project_phases")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Failed to remove phase");
    else { toast.success("Phase removed"); setPhases(prev => prev.filter(p => p.id !== id)); }
    setSaving(null);
  };

  const handleMove = async (id: string, dir: "up" | "down") => {
    const idx = phases.findIndex(p => p.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === phases.length - 1) return;
    const other = phases[dir === "up" ? idx - 1 : idx + 1];
    await Promise.all([
      supabase.from("project_phases").update({ order_index: other.order_index }).eq("id", id),
      supabase.from("project_phases").update({ order_index: phases[idx].order_index }).eq("id", other.id),
    ]);
    await load();
  };

  const statusBadge = (s: Phase["status"]) => {
    if (s === "complete") return <Badge className="bg-green-600 text-white text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
    if (s === "in-progress") return <Badge className="bg-orange-600 text-white text-xs"><Circle className="h-3 w-3 mr-1" />In Progress</Badge>;
    return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Upcoming</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Client sees these as their project timeline.</p>
        <div className="flex gap-2">
          {phases.length === 0 && (
            <Button size="sm" variant="outline" onClick={handleInitDefaults} disabled={initing}>
              {initing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Load Defaults
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Phase
          </Button>
        </div>
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No phases yet</p>
          <p className="text-xs mt-1">Click "Load Defaults" for standard phases or "Add Phase" to create custom ones.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, idx) => (
            <Card key={phase.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  {/* Up / Down */}
                  <div className="flex flex-col gap-0.5 mt-1">
                    <button
                      onClick={() => handleMove(phase.id, "up")}
                      disabled={idx === 0 || saving === phase.id}
                      className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleMove(phase.id, "down")}
                      disabled={idx === phases.length - 1 || saving === phase.id}
                      className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-gray-200 w-5 shrink-0">{idx + 1}</span>
                      {statusBadge(phase.status)}
                      <span className="font-semibold text-sm">{phase.label}</span>
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {(["upcoming", "in-progress", "complete"] as const).map(s => (
                        <Button
                          key={s}
                          size="sm"
                          variant={phase.status === s ? "default" : "outline"}
                          className={`text-xs h-7 ${
                            phase.status === s && s === "in-progress" ? "bg-orange-600 hover:bg-orange-700" :
                            phase.status === s && s === "complete" ? "bg-green-600 hover:bg-green-700" : ""
                          }`}
                          onClick={() => handleUpdate(phase.id, { status: s })}
                          disabled={saving === phase.id}
                        >
                          {s === "upcoming" ? "Upcoming" : s === "in-progress" ? "In Progress" : "Complete"}
                        </Button>
                      ))}
                    </div>

                    {/* Progress + dates */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Progress %</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={phase.progress_pct}
                          onChange={e => setPhases(prev => prev.map(p => p.id === phase.id ? { ...p, progress_pct: Number(e.target.value) } : p))}
                          onBlur={() => handleUpdate(phase.id, { progress_pct: phase.progress_pct })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Expected Date</label>
                        <Input
                          type="date"
                          value={phase.expected_date ?? ""}
                          onChange={e => handleUpdate(phase.id, { expected_date: e.target.value || null })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Completed Date</label>
                        <Input
                          type="date"
                          value={phase.completed_date ?? ""}
                          onChange={e => handleUpdate(phase.id, { completed_date: e.target.value || null })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          phase.status === "complete" ? "bg-green-600" :
                          phase.status === "in-progress" ? "bg-orange-600" : "bg-gray-300"
                        }`}
                        style={{ width: `${phase.progress_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(phase.id)}
                    disabled={saving === phase.id}
                    className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                  >
                    {saving === phase.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Phase Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) setNewLabel(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Phase</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Phase Name</label>
              <Input
                placeholder="e.g., Grading & Base"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setNewLabel(""); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAdd} disabled={!newLabel.trim() || adding}>
                {adding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Phase
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
