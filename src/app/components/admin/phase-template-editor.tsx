import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ChevronDown, ChevronRight, Plus, Trash2, Loader2, Camera, FileText, GripVertical } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Task {
  id: string;
  label: string;
  order_index: number;
  photo_required: boolean;
  note_required: boolean;
}

interface TemplatePhase {
  id: string;
  label: string;
  order_index: number;
  tasks: Task[];
}

interface Template {
  id: string;
  job_type: string;
  name: string;
  phases: TemplatePhase[];
}

const JOB_TYPE_LABELS: Record<string, string> = {
  pavers: "Pavers",
  retaining_walls: "Retaining Walls",
  outdoor_kitchen: "Outdoor Kitchen",
  concrete_standard: "Concrete (Standard)",
  concrete_stamped: "Concrete (Stamped)",
};

export function PhaseTemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  // Add phase state
  const [addingPhaseFor, setAddingPhaseFor] = useState<string | null>(null);
  const [newPhaseLabel, setNewPhaseLabel] = useState("");

  // Add task state
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [newTaskPhoto, setNewTaskPhoto] = useState(false);
  const [newTaskNote, setNewTaskNote] = useState(false);

  // Inline edit state
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskLabel, setEditTaskLabel] = useState("");

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<{
    type: "phase" | "task";
    templateId: string;
    phaseId: string;
    taskId?: string;
    label: string;
  } | null>(null);

  // Add job type
  const [addingJobType, setAddingJobType] = useState(false);
  const [newJobTypeName, setNewJobTypeName] = useState("");
  const [savingJobType, setSavingJobType] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("phase_templates")
      .select(`
        id, job_type, name,
        phases:phase_template_phases(
          id, label, order_index,
          tasks:phase_template_tasks(id, label, order_index, photo_required, note_required)
        )
      `)
      .order("name");

    if (error) { toast.error("Failed to load templates"); setLoading(false); return; }

    const sorted = (data ?? []).map((t: any) => ({
      ...t,
      phases: [...(t.phases ?? [])].sort((a: any, b: any) => a.order_index - b.order_index).map((p: any) => ({
        ...p,
        tasks: [...(p.tasks ?? [])].sort((a: any, b: any) => a.order_index - b.order_index),
      })),
    }));

    setTemplates(sorted);
    if (!activeTemplateId && sorted.length > 0) setActiveTemplateId(sorted[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeTemplate = templates.find(t => t.id === activeTemplateId) ?? null;

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
      return next;
    });
  };

  // ── Add phase ──────────────────────────────────────────────────────────────
  const handleAddPhase = async (templateId: string) => {
    if (!newPhaseLabel.trim()) return;
    setSaving("phase-add");
    const t = templates.find(x => x.id === templateId)!;
    const maxOrder = t.phases.length > 0 ? Math.max(...t.phases.map(p => p.order_index)) + 1 : 0;
    const { data, error } = await supabase
      .from("phase_template_phases")
      .insert({ template_id: templateId, label: newPhaseLabel.trim(), order_index: maxOrder })
      .select("id, label, order_index")
      .single();
    if (error) { toast.error("Failed to add phase"); }
    else {
      const newPhase: TemplatePhase = { ...data, tasks: [] };
      setTemplates(prev => prev.map(t2 =>
        t2.id === templateId ? { ...t2, phases: [...t2.phases, newPhase] } : t2
      ));
      setExpandedPhases(prev => new Set([...prev, data.id]));
      toast.success("Phase added");
    }
    setNewPhaseLabel("");
    setAddingPhaseFor(null);
    setSaving(null);
  };

  const handleDeletePhase = async (templateId: string, phaseId: string) => {
    setSaving(phaseId);
    const { error } = await supabase.from("phase_template_phases").delete().eq("id", phaseId);
    if (error) toast.error("Failed to delete phase");
    else {
      setTemplates(prev => prev.map(t =>
        t.id === templateId ? { ...t, phases: t.phases.filter(p => p.id !== phaseId) } : t
      ));
      toast.success("Phase deleted");
    }
    setSaving(null);
  };

  // ── Add task ───────────────────────────────────────────────────────────────
  const handleAddTask = async (templateId: string, phaseId: string) => {
    if (!newTaskLabel.trim()) return;
    setSaving("task-add");
    const phase = templates.find(t => t.id === templateId)?.phases.find(p => p.id === phaseId);
    const maxOrder = phase && phase.tasks.length > 0 ? Math.max(...phase.tasks.map(t => t.order_index)) + 1 : 0;
    const { data, error } = await supabase
      .from("phase_template_tasks")
      .insert({
        template_phase_id: phaseId,
        label: newTaskLabel.trim(),
        order_index: maxOrder,
        photo_required: newTaskPhoto,
        note_required: newTaskNote,
      })
      .select("id, label, order_index, photo_required, note_required")
      .single();
    if (error) { toast.error("Failed to add task"); }
    else {
      setTemplates(prev => prev.map(t =>
        t.id !== templateId ? t : {
          ...t,
          phases: t.phases.map(p =>
            p.id !== phaseId ? p : { ...p, tasks: [...p.tasks, data] }
          ),
        }
      ));
      toast.success("Task added");
    }
    setNewTaskLabel(""); setNewTaskPhoto(false); setNewTaskNote(false);
    setAddingTaskFor(null);
    setSaving(null);
  };

  const handleDeleteTask = async (templateId: string, phaseId: string, taskId: string) => {
    setSaving(taskId);
    const { error } = await supabase.from("phase_template_tasks").delete().eq("id", taskId);
    if (error) toast.error("Failed to delete task");
    else {
      setTemplates(prev => prev.map(t =>
        t.id !== templateId ? t : {
          ...t,
          phases: t.phases.map(p =>
            p.id !== phaseId ? p : { ...p, tasks: p.tasks.filter(tk => tk.id !== taskId) }
          ),
        }
      ));
      toast.success("Task deleted");
    }
    setSaving(null);
  };

  const handleSaveTaskLabel = async (templateId: string, phaseId: string, taskId: string) => {
    if (!editTaskLabel.trim()) { setEditingTask(null); return; }
    setSaving(taskId);
    const { error } = await supabase
      .from("phase_template_tasks")
      .update({ label: editTaskLabel.trim() })
      .eq("id", taskId);
    if (error) toast.error("Failed to save task");
    else {
      setTemplates(prev => prev.map(t =>
        t.id !== templateId ? t : {
          ...t,
          phases: t.phases.map(p =>
            p.id !== phaseId ? p : {
              ...p,
              tasks: p.tasks.map(tk => tk.id === taskId ? { ...tk, label: editTaskLabel.trim() } : tk),
            }
          ),
        }
      ));
    }
    setEditingTask(null);
    setSaving(null);
  };

  const handleToggleFlag = async (
    templateId: string, phaseId: string, taskId: string,
    field: "photo_required" | "note_required", current: boolean,
  ) => {
    setSaving(taskId + field);
    const { error } = await supabase.from("phase_template_tasks").update({ [field]: !current }).eq("id", taskId);
    if (error) { toast.error("Failed to update"); }
    else {
      setTemplates(prev => prev.map(t =>
        t.id !== templateId ? t : {
          ...t,
          phases: t.phases.map(p =>
            p.id !== phaseId ? p : {
              ...p,
              tasks: p.tasks.map(tk => tk.id === taskId ? { ...tk, [field]: !current } : tk),
            }
          ),
        }
      ));
    }
    setSaving(null);
  };

  const handleAddJobType = async () => {
    if (!newJobTypeName.trim()) return;
    setSavingJobType(true);
    const slug = newJobTypeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const { data, error } = await supabase
      .from("phase_templates")
      .insert({ name: newJobTypeName.trim(), job_type: slug })
      .select("id, job_type, name")
      .single();
    if (error) { toast.error("Failed to add job type"); }
    else {
      const newTemplate: Template = { ...data, phases: [] };
      setTemplates(prev => [...prev, newTemplate]);
      setActiveTemplateId(data.id);
      toast.success(`${data.name} template created`);
    }
    setNewJobTypeName("");
    setAddingJobType(false);
    setSavingJobType(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <div className="flex gap-6 h-full">
      {/* Left sidebar — template selector */}
      <div className="w-52 shrink-0 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Job Types</p>
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTemplateId(t.id); setAddingPhaseFor(null); setAddingTaskFor(null); }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTemplateId === t.id
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            {t.name}
            <div className={`text-xs font-normal mt-0.5 ${activeTemplateId === t.id ? "text-blue-100" : "text-muted-foreground"}`}>
              {t.phases.length} phase{t.phases.length !== 1 ? "s" : ""} · {t.phases.reduce((s, p) => s + p.tasks.length, 0)} tasks
            </div>
          </button>
        ))}
        <div className="mt-4 pt-3 border-t">
          {addingJobType ? (
            <div className="space-y-2">
              <Input
                placeholder="e.g., Drainage"
                value={newJobTypeName}
                onChange={e => setNewJobTypeName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddJobType();
                  if (e.key === "Escape") { setAddingJobType(false); setNewJobTypeName(""); }
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => { setAddingJobType(false); setNewJobTypeName(""); }}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddJobType} disabled={!newJobTypeName.trim() || savingJobType}>
                  {savingJobType && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingJobType(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Job Type
            </button>
          )}
        </div>
      </div>

      {/* Right — phases + tasks */}
      <div className="flex-1 min-w-0 space-y-3">
        {activeTemplate && (
          <>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-bold text-base">{activeTemplate.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Changes here apply to <strong>new projects only</strong> — existing project timelines are not affected.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAddingPhaseFor(activeTemplate.id); setAddingTaskFor(null); }}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Phase
              </Button>
            </div>

            {activeTemplate.phases.length === 0 && addingPhaseFor !== activeTemplate.id && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                <p className="text-sm font-medium">No phases yet</p>
                <p className="text-xs mt-1">Click "Add Phase" to build this template.</p>
              </div>
            )}

            {activeTemplate.phases.map((phase, phaseIdx) => {
              const isExpanded = expandedPhases.has(phase.id);

              return (
                <Card key={phase.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Phase header */}
                    <div
                      className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => togglePhase(phase.id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                      <span className="text-xs font-black text-gray-300 w-5 shrink-0">{phaseIdx + 1}</span>
                      <span className="font-semibold text-sm flex-1">{phase.label}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {phase.tasks.length} task{phase.tasks.length !== 1 ? "s" : ""}
                      </Badge>
                      <button
                        onClick={e => { e.stopPropagation(); setPendingDelete({ type: "phase", templateId: activeTemplate.id, phaseId: phase.id, label: phase.label }); }}
                        disabled={saving === phase.id}
                        className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 shrink-0"
                      >
                        {saving === phase.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Tasks */}
                    {isExpanded && (
                      <div className="border-t">
                        {phase.tasks.map((task, taskIdx) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50 group"
                          >
                            <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-300 w-4 shrink-0">{taskIdx + 1}</span>

                            {editingTask === task.id ? (
                              <Input
                                value={editTaskLabel}
                                onChange={e => setEditTaskLabel(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleSaveTaskLabel(activeTemplate.id, phase.id, task.id);
                                  if (e.key === "Escape") setEditingTask(null);
                                }}
                                onBlur={() => handleSaveTaskLabel(activeTemplate.id, phase.id, task.id)}
                                className="h-7 text-sm flex-1"
                                autoFocus
                              />
                            ) : (
                              <span
                                className="text-sm flex-1 cursor-text"
                                onDoubleClick={() => { setEditingTask(task.id); setEditTaskLabel(task.label); }}
                                title="Double-click to edit"
                              >
                                {task.label}
                              </span>
                            )}

                            {/* Flag toggles */}
                            <button
                              onClick={() => handleToggleFlag(activeTemplate.id, phase.id, task.id, "photo_required", task.photo_required)}
                              disabled={saving === task.id + "photo_required"}
                              title={task.photo_required ? "Photo required (click to remove)" : "Click to require photo"}
                              className={`p-1 rounded shrink-0 transition-colors ${task.photo_required ? "text-blue-600 bg-blue-50" : "text-gray-300 hover:text-blue-400"}`}
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleFlag(activeTemplate.id, phase.id, task.id, "note_required", task.note_required)}
                              disabled={saving === task.id + "note_required"}
                              title={task.note_required ? "Note required (click to remove)" : "Click to require note"}
                              className={`p-1 rounded shrink-0 transition-colors ${task.note_required ? "text-amber-600 bg-amber-50" : "text-gray-300 hover:text-amber-400"}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setPendingDelete({ type: "task", templateId: activeTemplate.id, phaseId: phase.id, taskId: task.id, label: task.label })}
                              disabled={saving === task.id}
                              className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {saving === task.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        ))}

                        {/* Add task row */}
                        {addingTaskFor === phase.id ? (
                          <div className="px-4 py-3 bg-gray-50 border-t space-y-2">
                            <Input
                              placeholder="Task description..."
                              value={newTaskLabel}
                              onChange={e => setNewTaskLabel(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleAddTask(activeTemplate.id, phase.id); if (e.key === "Escape") setAddingTaskFor(null); }}
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" checked={newTaskPhoto} onChange={e => setNewTaskPhoto(e.target.checked)} className="h-3.5 w-3.5" />
                                <Camera className="h-3 w-3 text-blue-600" /> Photo required
                              </label>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" checked={newTaskNote} onChange={e => setNewTaskNote(e.target.checked)} className="h-3.5 w-3.5" />
                                <FileText className="h-3 w-3 text-amber-600" /> Note required
                              </label>
                              <div className="ml-auto flex gap-2">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddingTaskFor(null); setNewTaskLabel(""); setNewTaskPhoto(false); setNewTaskNote(false); }}>
                                  Cancel
                                </Button>
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleAddTask(activeTemplate.id, phase.id)} disabled={!newTaskLabel.trim() || saving === "task-add"}>
                                  {saving === "task-add" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                  Add Task
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingTaskFor(phase.id); setAddingPhaseFor(null); setNewTaskLabel(""); setNewTaskPhoto(false); setNewTaskNote(false); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:bg-gray-50 hover:text-blue-600 transition-colors border-t"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add task
                          </button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Add phase inline form */}
            {addingPhaseFor === activeTemplate.id && (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700">New Phase Name</p>
                    <Input
                      placeholder="e.g., Finishing & Punch"
                      value={newPhaseLabel}
                      onChange={e => setNewPhaseLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddPhase(activeTemplate.id); if (e.key === "Escape") setAddingPhaseFor(null); }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => { setAddingPhaseFor(null); setNewPhaseLabel(""); }}>Cancel</Button>
                      <Button className="flex-1 h-8 text-sm" onClick={() => handleAddPhase(activeTemplate.id)} disabled={!newPhaseLabel.trim() || saving === "phase-add"}>
                        {saving === "phase-add" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        Add Phase
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3 text-blue-600" /> Blue = photo required</span>
              &nbsp;·&nbsp;
              <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-amber-600" /> Amber = note required</span>
              &nbsp;·&nbsp;
              Double-click any task label to rename it.
            </p>
          </>
        )}
      </div>
    </div>
    <AlertDialog open={pendingDelete !== null} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {pendingDelete?.type === "phase" ? "Phase" : "Task"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete?.type === "phase"
              ? `"${pendingDelete?.label}" and all its tasks will be permanently deleted. This cannot be undone.`
              : `"${pendingDelete?.label}" will be permanently deleted. This cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!pendingDelete) return;
              if (pendingDelete.type === "phase") {
                handleDeletePhase(pendingDelete.templateId, pendingDelete.phaseId);
              } else if (pendingDelete.taskId) {
                handleDeleteTask(pendingDelete.templateId, pendingDelete.phaseId, pendingDelete.taskId);
              }
              setPendingDelete(null);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
