import { useState, useEffect, useRef } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import {
  Plus, Edit2, Trash2, Upload, Image as ImageIcon, Send,
  CheckCircle2, Clock, X, ScanEye, Loader2, EyeOff, Layers,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "../ui/tooltip";
import { supabase, guessContentType } from "@/lib/supabase";
import { toast } from "sonner";

interface UpdatePhoto {
  id: string;
  public_url: string | null;
  label: string | null;
  order_index: number;
}

interface PortalUpdate {
  id: string;
  title: string;
  body: string;
  completed_items: string[];
  upcoming_items: string[];
  is_visible: boolean;
  posted_at: string;
  phase_id: string | null;
  photos: UpdatePhoto[];
}

interface Phase {
  id: string;
  label: string;
  progress_pct: number;
  status: string;
}

interface FormState {
  title: string;
  body: string;
  completedItems: string[];
  upcomingItems: string[];
  phaseId: string;
  phaseProgress: number;
}

interface Props {
  projectId: string;
}

const NO_PHASE = "none";

const emptyForm = (): FormState => ({
  title: "",
  body: "",
  completedItems: [""],
  upcomingItems: [""],
  phaseId: NO_PHASE,
  phaseProgress: 0,
});

export function PortalFieldUpdates({ projectId }: Props) {
  const [updates, setUpdates] = useState<PortalUpdate[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsVisible, setEditingIsVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ title?: string; body?: string }>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUpdate, setPreviewUpdate] = useState<PortalUpdate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<UpdatePhoto[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const load = async () => {
    setLoading(true);
    const [updatesRes, phasesRes] = await Promise.all([
      supabase
        .from("portal_updates")
        .select(`
          id, title, body, completed_items, upcoming_items, is_visible, posted_at, phase_id,
          photos:portal_update_photos(id, public_url, label, order_index)
        `)
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("posted_at", { ascending: false }),
      supabase
        .from("project_phases")
        .select("id, label, progress_pct, status")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("order_index", { ascending: true }),
    ]);

    if (updatesRes.error) toast.error("Failed to load field updates");
    else setUpdates((updatesRes.data ?? []).map((u: any) => ({
      ...u,
      photos: (u.photos ?? []).filter((p: any) => p.public_url).sort((a: any, b: any) => a.order_index - b.order_index),
    })));

    setPhases(phasesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);
  useRealtimeRefetch(load, ["portal_updates", "portal_update_photos", "project_phases"], `field-updates-${projectId}`);

  const phaseLabelFor = (phaseId: string | null) =>
    phases.find(p => p.id === phaseId)?.label ?? null;

  const openCreate = () => {
    setEditingId(null);
    setEditingIsVisible(false);
    setForm(emptyForm());
    setPendingPhotos([]);
    setExistingPhotos([]);
    setPhotosToDelete([]);
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (u: PortalUpdate) => {
    setFormErrors({});
    setEditingId(u.id);
    setEditingIsVisible(u.is_visible);
    const phase = phases.find(p => p.id === u.phase_id);
    setForm({
      title: u.title,
      body: u.body,
      completedItems: u.completed_items.length > 0 ? u.completed_items : [""],
      upcomingItems: u.upcoming_items.length > 0 ? u.upcoming_items : [""],
      phaseId: u.phase_id ?? NO_PHASE,
      phaseProgress: phase?.progress_pct ?? 0,
    });
    setPendingPhotos([]);
    setExistingPhotos(u.photos);
    setPhotosToDelete([]);
    setShowModal(true);
  };

  const handlePhaseChange = (phaseId: string) => {
    const phase = phaseId !== NO_PHASE ? phases.find(p => p.id === phaseId) : undefined;
    setForm(f => ({
      ...f,
      phaseId,
      phaseProgress: phase?.progress_pct ?? 0,
    }));
  };

  const removeExistingPhoto = (photoId: string) => {
    setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
    setPhotosToDelete(prev => [...prev, photoId]);
  };

  const setItem = (type: "completedItems" | "upcomingItems", idx: number, val: string) =>
    setForm(f => ({ ...f, [type]: f[type].map((v, i) => i === idx ? val : v) }));

  const addItem = (type: "completedItems" | "upcomingItems") =>
    setForm(f => ({ ...f, [type]: [...f[type], ""] }));

  const removeItem = (type: "completedItems" | "upcomingItems", idx: number) =>
    setForm(f => ({ ...f, [type]: f[type].filter((_, i) => i !== idx) }));

  const uploadPhotos = async (updateId: string, files: File[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      toast.error("Session expired — please refresh and try again");
      return [];
    }
    const results: UpdatePhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `portal-updates/${updateId}/${Date.now()}-${i}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("client-files").upload(path, file, { contentType: guessContentType(file) });
      if (uploadErr) { toast.error(`Photo ${i + 1} upload failed: ${uploadErr.message}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("client-files").getPublicUrl(path);
      const { data: photo, error: insertErr } = await supabase
        .from("portal_update_photos")
        .insert({
          update_id: updateId,
          uploaded_by: user.id,
          storage_path: path,
          public_url: publicUrl,
          order_index: i,
          approval_status: "approved",
        })
        .select("id, public_url, label, order_index")
        .single();
      if (insertErr) { toast.error(`Photo ${i + 1} saved to storage but failed to link: ${insertErr.message}`); continue; }
      if (photo) results.push(photo);
    }
    return results;
  };

  const handleSave = async (publishNow: boolean) => {
    const errors: { title?: string; body?: string } = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (publishNow && !form.body.trim()) errors.body = "Description is required to publish";
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setSaving(true);
    const completedItems = form.completedItems.filter(t => t.trim());
    const upcomingItems = form.upcomingItems.filter(t => t.trim());
    const phaseId = form.phaseId === NO_PHASE ? null : form.phaseId || null;

    // Update phase progress if a phase is selected
    if (phaseId) {
      const pct = Math.min(100, Math.max(0, form.phaseProgress));
      const status = pct >= 100 ? "complete" : pct > 0 ? "in-progress" : "upcoming";
      await supabase
        .from("project_phases")
        .update({ progress_pct: pct, status, updated_at: new Date().toISOString() })
        .eq("id", phaseId);
      // Refresh local phases list
      setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, progress_pct: pct, status } : p));
    }

    if (editingId) {
      const { error } = await supabase
        .from("portal_updates")
        .update({
          title: form.title,
          body: form.body,
          completed_items: completedItems,
          upcoming_items: upcomingItems,
          phase_id: phaseId,
          is_visible: publishNow,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (error) { toast.error("Failed to save update"); setSaving(false); return; }
      if (photosToDelete.length > 0) {
        await supabase.from("portal_update_photos").delete().in("id", photosToDelete);
      }
      if (pendingPhotos.length > 0) {
        setUploadingPhotos(true);
        await uploadPhotos(editingId, pendingPhotos);
        setUploadingPhotos(false);
      }
      toast.success(publishNow ? "Update published to portal" : "Changes saved");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newUpdate, error } = await supabase
        .from("portal_updates")
        .insert({
          project_id: projectId,
          posted_by: user?.id,
          title: form.title,
          body: form.body,
          completed_items: completedItems,
          upcoming_items: upcomingItems,
          phase_id: phaseId,
          is_visible: publishNow,
        })
        .select("id")
        .single();
      if (error || !newUpdate) { toast.error("Failed to create update"); setSaving(false); return; }
      if (pendingPhotos.length > 0) {
        setUploadingPhotos(true);
        await uploadPhotos(newUpdate.id, pendingPhotos);
        setUploadingPhotos(false);
      }
      toast.success(publishNow ? "Update published to portal" : "Draft saved");
    }

    setSaving(false);
    setShowModal(false);
    await load();
  };

  const handleToggleVisibility = async (u: PortalUpdate) => {
    setToggling(u.id);
    const { error } = await supabase
      .from("portal_updates")
      .update({ is_visible: !u.is_visible, updated_at: new Date().toISOString() })
      .eq("id", u.id);
    if (error) toast.error("Failed to update visibility");
    else {
      toast.success(u.is_visible ? "Hidden from client" : "Now visible to client");
      setUpdates(prev => prev.map(x => x.id === u.id ? { ...x, is_visible: !u.is_visible } : x));
    }
    setToggling(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase
      .from("portal_updates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Failed to delete update");
    else { toast.success("Update deleted"); setUpdates(prev => prev.filter(u => u.id !== id)); }
    setDeleting(null);
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
        <p className="text-sm text-muted-foreground">Publish field updates visible to the client on their portal.</p>
        <Button size="sm" className="gap-1.5 bg-orange-600 hover:bg-orange-700" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> New Update
        </Button>
      </div>

      {updates.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No field updates yet</p>
          <p className="text-xs mt-1">Create your first update to share progress with the client.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={u.is_visible ? "bg-green-600 text-white" : "bg-gray-400 text-white"}>
                        {u.is_visible
                          ? <><CheckCircle2 className="h-3 w-3 mr-1" />Published</>
                          : <><Clock className="h-3 w-3 mr-1" />Hidden</>}
                      </Badge>
                      {u.phase_id && phaseLabelFor(u.phase_id) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Layers className="h-2.5 w-2.5" />
                          {phaseLabelFor(u.phase_id)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="font-semibold text-sm mb-1">{u.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{u.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {u.photos.length > 0 && <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />{u.photos.length} photo{u.photos.length !== 1 ? "s" : ""}</span>}
                      {u.completed_items.length > 0 && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{u.completed_items.length} completed</span>}
                      {u.upcoming_items.length > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{u.upcoming_items.length} upcoming</span>}
                    </div>
                  </div>
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => setPreviewUpdate(u)}>
                            <ScanEye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Preview</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => openEdit(u)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 px-2.5 ${u.is_visible ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                            onClick={() => handleToggleVisibility(u)}
                            disabled={toggling === u.id}
                          >
                            {toggling === u.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : u.is_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{u.is_visible ? "Hide from client" : "Publish to client"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(u.id)}
                            disabled={deleting === u.id}
                          >
                            {deleting === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={v => { setShowModal(v); if (!v) { setForm(emptyForm()); setPendingPhotos([]); setExistingPhotos([]); setPhotosToDelete([]); setFormErrors({}); } }}>
        <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>
              {editingId ? "Edit Field Update" : "New Field Update"}
            </DialogTitle>
            <DialogDescription>Share progress, photos, and milestones with your client.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Phase selector */}
            {phases.length > 0 && (
              <div className="rounded-lg border bg-blue-50/50 p-4 space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" /> Phase (optional)
                </label>
                <Select value={form.phaseId} onValueChange={handlePhaseChange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select phase this update is about..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PHASE}>No phase</SelectItem>
                    {phases.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} — {p.progress_pct}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.phaseId && form.phaseId !== NO_PHASE && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Update progress to:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={form.phaseProgress}
                        onChange={e => setForm(f => ({ ...f, phaseProgress: Number(e.target.value) }))}
                        className="flex-1 accent-blue-600"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={form.phaseProgress}
                          onChange={e => setForm(f => ({ ...f, phaseProgress: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                          className="w-16 text-center text-sm h-8"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-1.5">
                      Phase progress will update when you save this update.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., Base prep complete — pavers arrive Thursday"
                value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormErrors(p => ({ ...p, title: undefined })); }}
                className={formErrors.title ? "border-red-500 focus-visible:ring-red-400" : ""}
              />
              {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
            </div>

            {/* Body */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Description <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Share what happened today, any notes for the client, what's next..."
                value={form.body}
                onChange={e => { setForm(f => ({ ...f, body: e.target.value })); setFormErrors(p => ({ ...p, body: undefined })); }}
                className={`min-h-[100px] ${formErrors.body ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              {formErrors.body && <p className="text-xs text-red-500 mt-1">{formErrors.body}</p>}
            </div>

            {/* Photos */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Photos {(existingPhotos.length + pendingPhotos.length) > 0 && (
                  <span className="text-orange-600">({existingPhotos.length + pendingPhotos.length} total)</span>
                )}
              </label>

              {existingPhotos.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">Saved photos — click × to remove</p>
                  <div className="grid grid-cols-4 gap-2">
                    {existingPhotos.map(p => (
                      <div key={p.id} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img src={p.public_url ?? ""} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeExistingPhoto(p.id)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                className="border-2 border-dashed rounded-lg p-5 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-7 w-7 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Click to add photos</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG — photos go live immediately for client</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  setPendingPhotos(prev => [...prev, ...files]);
                  e.target.value = "";
                }}
              />
              {pendingPhotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {pendingPhotos.map((f, i) => (
                    <div key={i} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPendingPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Completed This Week
                </label>
                <Button size="sm" variant="outline" onClick={() => addItem("completedItems")} className="gap-1 h-7 px-2 text-xs">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.completedItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="e.g., Excavation to spec depth"
                      value={item}
                      onChange={e => setItem("completedItems", i, e.target.value)}
                      className="text-sm"
                    />
                    {form.completedItems.length > 1 && (
                      <Button size="sm" variant="outline" className="shrink-0 h-9 w-9 p-0" onClick={() => removeItem("completedItems", i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" /> Coming Up Next
                </label>
                <Button size="sm" variant="outline" onClick={() => addItem("upcomingItems")} className="gap-1 h-7 px-2 text-xs">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.upcomingItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="e.g., Begin paver installation"
                      value={item}
                      onChange={e => setItem("upcomingItems", i, e.target.value)}
                      className="text-sm"
                    />
                    {form.upcomingItems.length > 1 && (
                      <Button size="sm" variant="outline" className="shrink-0 h-9 w-9 p-0" onClick={() => removeItem("upcomingItems", i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex-shrink-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            {editingId ? (
              <>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => handleSave(editingIsVisible)} disabled={saving || uploadingPhotos}>
                  {(saving || uploadingPhotos) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
                {!editingIsVisible && (
                  <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => handleSave(true)} disabled={saving || uploadingPhotos}>
                    {(saving || uploadingPhotos) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish Now
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => handleSave(false)} disabled={saving || uploadingPhotos}>
                  {(saving || uploadingPhotos) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save as Draft
                </Button>
                <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => handleSave(true)} disabled={saving || uploadingPhotos}>
                  {(saving || uploadingPhotos) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publish Now
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewUpdate && (
        <Dialog open={!!previewUpdate} onOpenChange={() => setPreviewUpdate(null)}>
          <DialogContent className="w-[92vw] max-w-2xl p-0 gap-0 flex flex-col max-h-[90vh]">
            {/* Fixed Header */}
            <div className="px-6 pt-5 pb-4 border-b shrink-0">
              <DialogTitle className="text-base font-semibold">Client Preview</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">How this update appears to the client</DialogDescription>
            </div>
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <Card>
                <CardContent className="p-5 sm:p-6 space-y-4">
                  {previewUpdate.phase_id && phaseLabelFor(previewUpdate.phase_id) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      <Layers className="h-2.5 w-2.5" />
                      {phaseLabelFor(previewUpdate.phase_id)}
                    </span>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {previewUpdate.photos.length > 0
                      ? previewUpdate.photos.slice(0, 3).map(p => (
                          <div key={p.id} className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                            <img src={p.public_url ?? ""} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))
                      : [1, 2, 3].map(i => (
                          <div key={i} className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-300" />
                          </div>
                        ))}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-2 tracking-wide">
                      {new Date(previewUpdate.posted_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
                    </div>
                    <h4 className="text-lg font-bold mb-2" style={{ fontFamily: "Lato, sans-serif" }}>{previewUpdate.title}</h4>
                    <p className="text-sm text-gray-700">{previewUpdate.body}</p>
                  </div>
                  {(previewUpdate.completed_items.length > 0 || previewUpdate.upcoming_items.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t">
                      {previewUpdate.completed_items.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-bold text-green-700">COMPLETED</span>
                          </div>
                          <div className="space-y-1.5 pl-6">
                            {previewUpdate.completed_items.map((t, i) => <div key={i} className="text-sm text-gray-700">{t}</div>)}
                          </div>
                        </div>
                      )}
                      {previewUpdate.upcoming_items.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span className="text-xs font-bold text-orange-700">COMING UP</span>
                          </div>
                          <div className="space-y-1.5 pl-6">
                            {previewUpdate.upcoming_items.map((t, i) => <div key={i} className="text-sm text-gray-700">{t}</div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
