import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  CheckCircle2, Circle, Clock, Loader2, ChevronDown as CollapseIcon, ChevronRight as ExpandIcon,
  Camera, FileText, CheckSquare, Square, X, Download,
} from "lucide-react";
import { supabase, guessContentType } from "@/lib/supabase";
import { toast } from "sonner";

interface Task {
  id: string;
  task_label: string;
  order_index: number;
  photo_required: boolean;
  note_required: boolean;
  is_completed: boolean;
  photo_url: string | null;
  photo_approval_status: string;
  note: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

interface Phase {
  id: string;
  label: string;
  order_index: number;
  status: "upcoming" | "in-progress" | "complete";
  progress_pct: number;
  expected_date: string | null;
  completed_date: string | null;
  tasks: Task[];
}

interface Template {
  id: string;
  job_type: string;
  name: string;
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
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Template picker
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Delete confirmation
  const [pendingDeletePhase, setPendingDeletePhase] = useState<{ id: string; label: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Photo preview
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string } | null>(null);

  // Current user role (for photo auto-approve)
  const [userRole, setUserRole] = useState<string | null>(null);

  // Task completion state
  const [taskNoteEdit, setTaskNoteEdit] = useState<{ id: string; value: string } | null>(null);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [approvingTask, setApprovingTask] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTaskId = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_phases")
      .select(`
        id, label, order_index, status, progress_pct, expected_date, completed_date,
        tasks:phase_task_completions(
          id, task_label, order_index, photo_required, note_required,
          is_completed, photo_url, photo_approval_status, note, completed_by, completed_at
        )
      `)
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (error) { toast.error("Failed to load phases"); setLoading(false); return; }

    const sorted = (data ?? []).map((p: any) => ({
      ...p,
      tasks: [...(p.tasks ?? [])].sort((a: any, b: any) => a.order_index - b.order_index),
    }));
    setPhases(sorted);
    setLoading(false);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("phase_templates")
      .select("id, job_type, name")
      .order("name");
    setTemplates(data ?? []);
  };

  useEffect(() => {
    load();
    loadTemplates();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setUserRole(data?.role ?? null));
    });
  }, [projectId]);

  // ── Progress auto-compute ──────────────────────────────────────────────────
  const computeProgress = (tasks: Task[]): number => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100);
  };

  const syncProgress = async (phaseId: string, tasks: Task[]) => {
    const pct = computeProgress(tasks);
    const autoStatus: Phase["status"] = pct === 100 ? "complete" : pct > 0 ? "in-progress" : "upcoming";
    const dbUpdates: Record<string, any> = { progress_pct: pct, updated_at: new Date().toISOString() };
    if (tasks.length > 0) dbUpdates.status = autoStatus;
    await supabase.from("project_phases").update(dbUpdates).eq("id", phaseId);
    setPhases(prev => prev.map(p =>
      p.id === phaseId
        ? { ...p, progress_pct: pct, ...(tasks.length > 0 ? { status: autoStatus } : {}) }
        : p
    ));
  };

  // ── Template loading ───────────────────────────────────────────────────────
  const toggleTemplateId = (id: string) => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleLoadTemplates = async () => {
    if (selectedTemplateIds.size === 0) return;
    setLoadingTemplates(true);

    for (const tid of [...selectedTemplateIds]) {
      const { data: maxPhase } = await supabase
        .from("project_phases")
        .select("order_index")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxPhase?.order_index ?? -1) + 1;

      const { data: tPhases, error } = await supabase
        .from("phase_template_phases")
        .select(`id, label, order_index, tasks:phase_template_tasks(label, order_index, photo_required, note_required)`)
        .eq("template_id", tid)
        .order("order_index", { ascending: true });

      if (error) { toast.error("Failed to load template: " + error.message); setLoadingTemplates(false); return; }

      for (const tp of (tPhases ?? [])) {
        const { data: newPhase } = await supabase
          .from("project_phases")
          .insert({ project_id: projectId, label: tp.label, order_index: nextOrder + tp.order_index, status: "upcoming", progress_pct: 0 })
          .select("id")
          .single();

        if (newPhase && (tp as any).tasks?.length > 0) {
          await supabase.from("phase_task_completions").insert(
            (tp as any).tasks.map((t: any) => ({
              project_id: projectId,
              phase_id: newPhase.id,
              task_label: t.label,
              order_index: t.order_index,
              photo_required: t.photo_required,
              note_required: t.note_required,
              is_completed: false,
            }))
          );
        }
      }
    }

    const count = selectedTemplateIds.size;
    toast.success(count === 1 ? "Phases added from template!" : `Phases added from ${count} templates!`);
    await load();
    setExpandedPhases(new Set());
    setSelectedTemplateIds(new Set());
    setLoadingTemplates(false);
    setShowTemplatePicker(false);
  };

  const handleClearAllPhases = async () => {
    const { data: existing } = await supabase
      .from("project_phases")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_active", true);
    if (!existing?.length) return;
    const ids = existing.map((p: any) => p.id);
    await supabase.from("phase_task_completions").delete().in("phase_id", ids);
    await supabase.from("project_phases").update({ is_active: false }).in("id", ids);
    await load();
    toast.success("All phases cleared");
  };

  // ── Phase CRUD ─────────────────────────────────────────────────────────────
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

  const handleUpdate = async (id: string, updates: Partial<Omit<Phase, "id" | "tasks">>) => {
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
    setSaving(id);
    const otherIdx = dir === "up" ? idx - 1 : idx + 1;
    const other = phases[otherIdx];
    setPhases(prev =>
      prev.map(p => {
        if (p.id === id) return { ...p, order_index: other.order_index };
        if (p.id === other.id) return { ...p, order_index: phases[idx].order_index };
        return p;
      }).sort((a, b) => a.order_index - b.order_index)
    );
    await Promise.all([
      supabase.from("project_phases").update({ order_index: other.order_index }).eq("id", id),
      supabase.from("project_phases").update({ order_index: phases[idx].order_index }).eq("id", other.id),
    ]);
    setSaving(null);
  };

  // ── Task completion ────────────────────────────────────────────────────────
  const handleToggleTask = async (phase: Phase, task: Task) => {
    if (!task.is_completed && task.photo_required && !task.photo_url) {
      toast.error("A photo is required before completing this task.");
      return;
    }
    if (!task.is_completed && task.note_required && !task.note?.trim()) {
      toast.error("A note is required before completing this task.");
      return;
    }

    setSaving(task.id);
    const { data: { user } } = await supabase.auth.getUser();
    const nowISO = new Date().toISOString();
    const updates = task.is_completed
      ? { is_completed: false, completed_by: null, completed_at: null }
      : { is_completed: true, completed_by: user?.id ?? null, completed_at: nowISO };

    const { error } = await supabase
      .from("phase_task_completions")
      .update({ ...updates, updated_at: nowISO })
      .eq("id", task.id);

    if (error) { toast.error("Failed to update task"); setSaving(null); return; }

    const updatedTasks = phase.tasks.map(t =>
      t.id === task.id ? { ...t, ...updates } : t
    );
    setPhases(prev => prev.map(p => p.id === phase.id ? { ...p, tasks: updatedTasks } : p));
    await syncProgress(phase.id, updatedTasks);
    setSaving(null);
  };

  const handleSaveNote = async (phase: Phase, taskId: string, note: string) => {
    setSaving(taskId);
    const { error } = await supabase
      .from("phase_task_completions")
      .update({ note: note.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) { toast.error("Failed to save note"); }
    else {
      setPhases(prev => prev.map(p =>
        p.id === phase.id
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, note: note.trim() || null } : t) }
          : p
      ));
    }
    setTaskNoteEdit(null);
    setSaving(null);
  };

  const handleUploadPhoto = async (phase: Phase, taskId: string, file: File) => {
    setUploadingTask(taskId);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${projectId}/${taskId}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from("phase-task-photos")
      .upload(path, bytes, { upsert: true, contentType: guessContentType(file) });

    if (uploadErr) { toast.error("Photo upload failed: " + uploadErr.message); setUploadingTask(null); return; }

    const { data: { publicUrl } } = supabase.storage.from("phase-task-photos").getPublicUrl(path);
    const approvalStatus = userRole === "admin" ? "approved" : "pending";

    const { error } = await supabase
      .from("phase_task_completions")
      .update({ photo_url: publicUrl, photo_approval_status: approvalStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) { toast.error("Failed to save photo URL"); }
    else {
      setPhases(prev => prev.map(p =>
        p.id === phase.id
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, photo_url: publicUrl, photo_approval_status: approvalStatus } : t) }
          : p
      ));
      toast.success(approvalStatus === "approved" ? "Photo uploaded and approved" : "Photo uploaded — pending admin review");
    }
    setUploadingTask(null);
  };

  const handleApprovePhoto = async (phase: Phase, taskId: string) => {
    setApprovingTask(taskId);
    const { error } = await supabase
      .from("phase_task_completions")
      .update({ photo_approval_status: "approved", updated_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) { toast.error("Failed to approve photo"); }
    else {
      setPhases(prev => prev.map(p =>
        p.id === phase.id
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, photo_approval_status: "approved" } : t) }
          : p
      ));
      toast.success("Photo approved — client can now see it");
    }
    setApprovingTask(null);
  };

  const handleRejectPhoto = async (phase: Phase, taskId: string) => {
    setApprovingTask(taskId);
    const { error } = await supabase
      .from("phase_task_completions")
      .update({ photo_url: null, photo_approval_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) { toast.error("Failed to reject photo"); }
    else {
      setPhases(prev => prev.map(p =>
        p.id === phase.id
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, photo_url: null, photo_approval_status: "pending" } : t) }
          : p
      ));
      toast.success("Photo rejected — field team will need to re-upload");
    }
    setApprovingTask(null);
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const statusBadge = (s: Phase["status"], pct: number, taskCount: number) => {
    if (s === "complete") return <Badge className="bg-green-600 text-white text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
    if (s === "in-progress") return <Badge className="bg-orange-600 text-white text-xs"><Circle className="h-3 w-3 mr-1" />In Progress {taskCount > 0 ? `· ${pct}%` : ""}</Badge>;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Client sees these as their project timeline.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmClearAll(true)} disabled={loadingTemplates}>
            Clear All
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTemplatePicker(v => !v)} disabled={loadingTemplates}>
            {loadingTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Load Template
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Phase
          </Button>
        </div>
      </div>

      {/* Inline template picker */}
      {showTemplatePicker && (
        <div className="border border-border rounded-lg p-4 bg-muted/40 space-y-3">
          <p className="text-xs text-muted-foreground">Select one or more job types to add. Existing phases are kept — nothing is removed.</p>
          <div className="space-y-2">
            {templates.map(t => (
              <label key={t.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-background hover:bg-accent cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTemplateIds.has(t.id)}
                  onChange={() => toggleTemplateId(t.id)}
                  disabled={loadingTemplates}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium">{t.name}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowTemplatePicker(false); setSelectedTemplateIds(new Set()); }}
              disabled={loadingTemplates}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedTemplateIds.size === 0 || loadingTemplates}
              onClick={handleLoadTemplates}
            >
              {loadingTemplates
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Loading...</>
                : `Load${selectedTemplateIds.size > 0 ? ` (${selectedTemplateIds.size})` : ""}`}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {phases.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No phases yet</p>
          <p className="text-xs mt-1">Click "Load from Template" to use a job type template, or "Add Phase" to create manually.</p>
        </div>
      )}

      {/* Phase list */}
      <div className="space-y-3">
        {phases.map((phase, idx) => {
          const isExpanded = expandedPhases.has(phase.id);
          const tasksDone = phase.tasks.filter(t => t.is_completed).length;
          const tasksTotal = phase.tasks.length;

          return (
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
                      {statusBadge(phase.status, phase.progress_pct, tasksTotal)}
                      <span className="font-semibold text-sm flex-1">{phase.label}</span>
                      {tasksTotal > 0 && (
                        <button
                          onClick={() => setExpandedPhases(prev => {
                            const next = new Set(prev);
                            if (next.has(phase.id)) next.delete(phase.id); else next.add(phase.id);
                            return next;
                          })}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                        >
                          {isExpanded ? <CollapseIcon className="h-3.5 w-3.5" /> : <ExpandIcon className="h-3.5 w-3.5" />}
                          {tasksDone}/{tasksTotal} tasks
                        </button>
                      )}
                    </div>

                    {/* Task checklist */}
                    {isExpanded && tasksTotal > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        {phase.tasks.map((task) => (
                          <div key={task.id} className="border-b last:border-b-0">
                            {/* Task row */}
                            <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50">
                              <button
                                onClick={() => handleToggleTask(phase, task)}
                                disabled={saving === task.id}
                                className="shrink-0 mt-0.5"
                              >
                                {saving === task.id
                                  ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                  : task.is_completed
                                    ? <CheckSquare className="h-4 w-4 text-green-600" />
                                    : <Square className="h-4 w-4 text-gray-300" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-snug ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>
                                  {task.task_label}
                                </p>

                                {/* Requirement indicators */}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  {/* Photo requirement */}
                                  {task.photo_required && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {task.photo_url ? (
                                        <>
                                          <button
                                            onClick={() => setPreviewPhoto({ url: task.photo_url!, label: task.task_label })}
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                          >
                                            <Camera className="h-3 w-3" /> View photo
                                          </button>
                                          {task.photo_approval_status === "approved" ? (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                              ✓ Approved
                                            </span>
                                          ) : (
                                            <>
                                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                                Pending Review
                                              </span>
                                              {userRole === "admin" && (
                                                <>
                                                  <button
                                                    onClick={() => handleApprovePhoto(phase, task.id)}
                                                    disabled={approvingTask === task.id}
                                                    className="text-[10px] font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
                                                  >
                                                    {approvingTask === task.id ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Approve"}
                                                  </button>
                                                  <span className="text-gray-300 text-[10px]">·</span>
                                                  <button
                                                    onClick={() => handleRejectPhoto(phase, task.id)}
                                                    disabled={approvingTask === task.id}
                                                    className="text-[10px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
                                                  >
                                                    Reject
                                                  </button>
                                                </>
                                              )}
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            pendingUploadTaskId.current = task.id;
                                            fileInputRef.current?.click();
                                          }}
                                          disabled={uploadingTask === task.id}
                                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                                        >
                                          {uploadingTask === task.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <Camera className="h-3 w-3" />}
                                          {uploadingTask === task.id ? "Uploading..." : "Upload photo (required)"}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Note requirement */}
                                  {task.note_required && (
                                    <div className="flex items-center gap-1">
                                      {task.note ? (
                                        <button
                                          onClick={() => setTaskNoteEdit({ id: task.id, value: task.note! })}
                                          className="flex items-center gap-1 text-xs text-amber-600 hover:underline"
                                        >
                                          <FileText className="h-3 w-3" /> Edit note
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => setTaskNoteEdit({ id: task.id, value: "" })}
                                          className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-700"
                                        >
                                          <FileText className="h-3 w-3" /> Add note (required)
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Optional note for non-required tasks */}
                                  {!task.note_required && task.note && (
                                    <span className="text-xs text-muted-foreground italic truncate max-w-xs">"{task.note}"</span>
                                  )}
                                </div>

                                {/* Inline note editor */}
                                {taskNoteEdit?.id === task.id && (
                                  <div className="mt-2 flex gap-2">
                                    <Input
                                      value={taskNoteEdit.value}
                                      onChange={e => setTaskNoteEdit({ id: task.id, value: e.target.value })}
                                      placeholder="Add note..."
                                      className="h-7 text-xs flex-1"
                                      onKeyDown={e => {
                                        if (e.key === "Enter") handleSaveNote(phase, task.id, taskNoteEdit.value);
                                        if (e.key === "Escape") setTaskNoteEdit(null);
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs px-3"
                                      onClick={() => handleSaveNote(phase, task.id, taskNoteEdit.value)}
                                      disabled={saving === task.id}
                                    >
                                      Save
                                    </Button>
                                    <button onClick={() => setTaskNoteEdit(null)} className="p-1 hover:bg-gray-100 rounded">
                                      <X className="h-3.5 w-3.5 text-gray-400" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

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
                        <label className="text-xs font-semibold text-gray-500 block mb-1">
                          Progress % {tasksTotal > 0 && <span className="font-normal text-muted-foreground">(auto from tasks)</span>}
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={phase.progress_pct}
                          onChange={e => setPhases(prev => prev.map(p => p.id === phase.id ? { ...p, progress_pct: Number(e.target.value) } : p))}
                          onBlur={e => handleUpdate(phase.id, { progress_pct: Math.min(100, Math.max(0, Number(e.target.value))) })}
                          className="h-8 text-sm"
                          disabled={tasksTotal > 0}
                          title={tasksTotal > 0 ? "Automatically computed from task completions" : ""}
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
                    <div className={`h-1.5 rounded-full overflow-hidden ${
                      phase.status === "complete" ? "bg-green-100" :
                      phase.status === "in-progress" ? "bg-orange-100" : "bg-gray-200"
                    }`}>
                      <div
                        className={`h-full rounded-full transition-all ${
                          phase.status === "complete" ? "bg-green-600" :
                          phase.status === "in-progress" ? "bg-orange-500" : "bg-gray-300"
                        }`}
                        style={{ width: `${phase.progress_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => setPendingDeletePhase({ id: phase.id, label: phase.label })}
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
          );
        })}
      </div>

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const taskId = pendingUploadTaskId.current;
          if (!file || !taskId) return;
          const phase = phases.find(p => p.tasks.some(t => t.id === taskId))!;
          await handleUploadPhoto(phase, taskId, file);
          e.target.value = "";
        }}
      />


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

      {/* Photo Preview Modal */}
      <Dialog open={previewPhoto !== null} onOpenChange={v => { if (!v) setPreviewPhoto(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pr-12 py-3 border-b flex flex-row items-center gap-3">
            <DialogTitle className="text-sm font-semibold flex-1 truncate">{previewPhoto?.label}</DialogTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 shrink-0"
              onClick={async () => {
                if (!previewPhoto?.url) return;
                const res = await fetch(previewPhoto.url);
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = (previewPhoto.label ?? "photo") + ".jpg";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </DialogHeader>
          <div className="flex items-center justify-center bg-gray-50 min-h-48 max-h-[70vh] overflow-hidden">
            {previewPhoto?.url && (
              <img
                src={previewPhoto.url}
                alt={previewPhoto.label}
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Phase Confirmation */}
      <AlertDialog open={pendingDeletePhase !== null} onOpenChange={open => { if (!open) setPendingDeletePhase(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phase?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDeletePhase?.label}" will be permanently removed from this project's timeline. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeletePhase) handleDelete(pendingDeletePhase.id);
                setPendingDeletePhase(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Phases Confirmation */}
      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Phases?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all phases and task completions for this project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleClearAllPhases(); setConfirmClearAll(false); }}
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
