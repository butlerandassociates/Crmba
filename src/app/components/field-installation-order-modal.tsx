import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import baLogoUrl from "@/assets/ba-logo.png";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Plus, Trash2, FileDown, Loader2, Edit, Check, X, DollarSign, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { fioAPI, notificationsAPI, activityLogAPI, productsAPI } from "../utils/api";
import { usePermissions } from "../hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface FIOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onCrewPayment?: () => void;
  onFioSaved?: () => void;
}

type View = "view" | "edit" | "pay_crew";

export function FieldInstallationOrderModal({ open, onOpenChange, project, onCrewPayment, onFioSaved }: FIOModalProps) {
  const { can, role } = usePermissions();
  const [view, setView] = useState<View>("view");
  const [fioList, setFioList] = useState<any[]>([]);
  const [fio, setFio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [units, setUnits] = useState<string[]>([]);
  const [foremen, setForemen] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState<string | null>(null);
  const [addingCrew, setAddingCrew] = useState(false);
  const [newCrewForemanId, setNewCrewForemanId] = useState("");
  const [reassignForemanId, setReassignForemanId] = useState("");

  const [editWorkDate, setEditWorkDate] = useState("");
  const [markingComplete, setMarkingComplete] = useState(false);
  const [removingCrew, setRemovingCrew] = useState(false);
  const [removeCrewTarget, setRemoveCrewTarget] = useState<any>(null);
  const [removeItemTarget, setRemoveItemTarget] = useState<number | null>(null);
  const [showDeleteFioConfirm, setShowDeleteFioConfirm] = useState(false);
  const [deletingFio, setDeletingFio] = useState(false);

  // Pay Crew state
  const [completionPct, setCompletionPct] = useState<Record<string, number>>({});
  const [crewPayments, setCrewPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [recording, setRecording] = useState(false);
  const [weekEndingDate, setWeekEndingDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const d = new Date(today);
    d.setDate(today.getDate() + daysUntilSunday);
    return d.toISOString().split("T")[0];
  });
  const [payNotes, setPayNotes] = useState("");


  useEffect(() => {
    supabase.from("units").select("name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setUnits((data ?? []).map((u: any) => u.name)));
    supabase.from("profiles").select("id, first_name, last_name").eq("role", "foreman").eq("is_active", true).order("first_name")
      .then(({ data }) => setForemen(data ?? []));
    productsAPI.getAll().then((data) => setAllProducts((data ?? []).filter((p: any) => (p.labor_cost ?? 0) > 0))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || !project?.id) return;
    loadFIO();
  }, [open, project?.id]);

  useRealtimeRefetch(() => { if (open && project?.id) loadFIO(); }, ["field_installation_orders", "fio_crew_payments"], `fio-${project?.id}`);

  const loadCrewPayments = async (fioId: string) => {
    setLoadingPayments(true);
    try {
      const data = await fioAPI.getCrewPayments(fioId);
      setCrewPayments(data);
    } catch {
      toast.error("Failed to load payment history — please refresh.");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!fio) return;
    const entries = (fio.items || [])
      .filter((item: any) => (completionPct[item.id] || 0) > 0)
      .map((item: any) => {
        const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
        const pct = completionPct[item.id] || 0;
        return { fio_item_id: item.id, completion_pct: pct, amount_paid: total * (pct / 100) };
      });
    if (!weekEndingDate) { toast.error("Week ending date is required."); return; }
    if (entries.length === 0) { toast.error("Enter a completion percentage for at least one item."); return; }
    setRecording(true);
    try {
      await fioAPI.recordCrewPayment(fio.id, weekEndingDate, entries, payNotes);

      // Notify admin that crew pay was submitted and needs review
      const projectName = project?.name ?? "a project";
      const foremanName = fio?.foreman
        ? `${fio.foreman.first_name ?? ""} ${fio.foreman.last_name ?? ""}`.trim()
        : "the crew";
      await notificationsAPI.create({
        type: "crew_payment_submitted",
        title: "Crew Pay Needs Review",
        message: `Crew payment recorded for ${foremanName} on ${projectName} — week ending ${weekEndingDate}. Review in Payroll.`,
        link: fio?.foreman?.id ? `/payroll/crew/${fio.foreman.id}` : "/payroll",
        metadata: { fio_id: fio.id, project_id: project?.id, week_ending_date: weekEndingDate },
      });

      activityLogAPI.create({ client_id: project.client?.id, action_type: "crew_payment_submitted", description: `Crew payment submitted — ${foremanName} on ${projectName}, week ending ${weekEndingDate}` }).catch(() => {});
      if (fio.status === "draft") {
        fioAPI.update(fio.id, { status: "partial_paid" }).catch(() => {});
        setFio((prev: any) => ({ ...prev, status: "partial_paid" }));
      }
      toast.success("Payment recorded — submitted to admin for review");
      setCompletionPct({});
      setPayNotes("");
      loadCrewPayments(fio.id);
      onCrewPayment?.();
      onFioSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setRecording(false);
    }
  };

  const loadFIO = async (selectFioId?: string) => {
    setLoading(true);
    setItemErrors({});
    try {
      const list = await fioAPI.getByProject(project.id);
      setFioList(list);
      setAddingCrew(false);
      setNewCrewForemanId("");
      if (list.length > 0) {
        const selected = selectFioId ? list.find((f: any) => f.id === selectFioId) ?? list[0] : list[0];
        setFio(selected);
        setEditItems(selected.items || []);
        setEditWorkDate(selected.work_date || "");
        const init: Record<string, number> = {};
        (selected.items || []).forEach((item: any) => { init[item.id] = 0; });
        setCompletionPct(init);
        loadCrewPayments(selected.id);
        fetchLaborFromEstimate().then(setSuggestedItems);
        setView("view");
      } else {
        setFio(null);
        setEditWorkDate("");
        const items = await fetchLaborFromEstimate();
        setSuggestedItems(items);
        setCheckedIds(new Set());
        setEditItems([]);
        setView(role === "sales_rep" ? "view" : "edit");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLaborFromEstimate = async () => {
    if (!project?.client?.id) return [];
    const { data: estimates } = await supabase
      .from("estimates").select("id").eq("client_id", project.client.id)
      .order("created_at", { ascending: false }).limit(1);
    if (!estimates || estimates.length === 0) return [];
    const { data: items } = await supabase
      .from("estimate_line_items").select("*").eq("estimate_id", estimates[0].id).gt("labor_cost", 0);
    return (items || []).map((item: any, i: number) => {
      const fieldQty = item.fio_qty || item.quantity;
      return {
        id: `new-${i}`,
        product_name: item.product_name,
        unit: item.unit,
        quantity: fieldQty,
        labor_cost_per_unit: item.labor_cost,
        total_labor: fieldQty * item.labor_cost,
        notes: "",
      };
    });
  };

  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  const handleSave = async () => {
    // Foreman required for new FIO — can be from project default or explicitly selected
    const foremanId = fio ? fio.foreman_id : (newCrewForemanId || project?.foreman?.id || null);
    if (!fio && !foremanId) {
      toast.error("Select a foreman for this crew before creating the FIO.");
      return;
    }
    if (editItems.length === 0) { toast.error("At least one labor item is required."); return; }
    const errs: Record<number, string> = {};
    editItems.forEach((item, idx) => {
      if (!item.product_name.trim()) errs[idx] = "Product name is required";
      else if (!item.unit.trim()) errs[idx] = "Unit is required";
      else if ((parseFloat(item.quantity) || 0) <= 0) errs[idx] = "Quantity must be greater than 0";
    });
    if (Object.keys(errs).length > 0) { setItemErrors(errs); return; }
    setItemErrors({});
    setSaving(true);
    try {
      const items = editItems.map((item) => ({
        id: item.id,
        product_name: item.product_name,
        unit: item.unit,
        quantity: parseFloat(item.quantity) || 0,
        labor_cost_per_unit: parseFloat(item.labor_cost_per_unit) || 0,
        notes: item.notes || "",
      }));
      if (fio) {
        const updatePayload: any = { work_date: editWorkDate || null };
        if (reassignForemanId && reassignForemanId !== fio.foreman_id) updatePayload.foreman_id = reassignForemanId;
        await fioAPI.update(fio.id, updatePayload);
        await fioAPI.updateItems(fio.id, items);
        activityLogAPI.create({ client_id: project.client?.id, action_type: "fio_updated", description: `Field Installation Order updated — project: ${project.name ?? ""}` }).catch(() => {});
        toast.success("Field Installation Order updated");
        loadFIO(fio.id);
        onFioSaved?.();
      } else {
        const created = await fioAPI.create(
          { project_id: project.id, foreman_id: foremanId, work_date: editWorkDate || undefined },
          items
        );
        activityLogAPI.create({ client_id: project.client?.id, action_type: "fio_created", description: `Field Installation Order created — project: ${project.name ?? ""}` }).catch(() => {});
        notificationsAPI.create({
          type: "fio_created",
          title: "FIO Created",
          message: `Field Installation Order created for ${project.name ?? "a project"}.`,
          link: project.client_id ? `/clients/${project.client_id}` : "/projects",
          metadata: { project_id: project.id },
        }).catch(() => {});
        toast.success("Field Installation Order created");
        loadFIO(created.id);
        onFioSaved?.();
      }
      setView("view");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const M = 14;

      // Load logo via canvas — preserve actual aspect ratio
      let logoData: string | null = null;
      let logoW = 20; let logoH = 20;
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image(); i.crossOrigin = "anonymous";
          i.onload = () => res(i); i.onerror = rej;
          i.src = "https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png";
        });
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        c.getContext("2d")!.drawImage(img, 0, 0);
        logoData = c.toDataURL("image/png");
        logoH = 13; logoW = (img.width / img.height) * logoH;
      } catch {}

      const fmtCur = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
      const fmtDate = (d: string) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
      const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const foremanName = fio?.foreman ? `${fio.foreman.first_name ?? ""} ${fio.foreman.last_name ?? ""}`.trim() : "";
      const items: any[] = fio?.items || [];
      const total = items.reduce((s: number, i: any) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.labor_cost_per_unit) || 0), 0);

      let y = 0;

      // ── Dark header ──
      const HDR = 24;
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, W, HDR, "F");
      const logoTop = (HDR - logoH) / 2;
      if (logoData) doc.addImage(logoData, "PNG", M, logoTop, logoW, logoH);
      const textX = M + logoW + 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
      doc.text("Butler & Associates Construction, Inc.", textX, 9);
      doc.setFontSize(7); doc.setTextColor(170, 170, 170);
      doc.text("6275 University Drive NW, Suite 37-314, Huntsville, AL 35806", textX, 14);
      doc.text("(256) 617-4691  ·  info@butlerconstruction.co", textX, 18.5);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(187, 152, 77);
      doc.text("FIELD INSTALLATION ORDER", W - M, 9, { align: "right" });
      y = HDR;

      // ── Gold rule ──
      doc.setFillColor(187, 152, 77); doc.rect(0, y, W, 0.8, "F");
      y += 7;

      // ── Project / Date ──
      const addressLine = [project?.client?.address, project?.client?.city, project?.client?.state, project?.client?.zip].filter(Boolean).join(", ") || project?.name || "—";
      const dateRangeLine = (project?.start_date && project?.end_date)
        ? `${fmtDate(project.start_date)} – ${fmtDate(project.end_date)}`
        : project?.start_date ? fmtDate(project.start_date) : today;
      const dateLabel = `Work Date: ${dateRangeLine}`;
      const dateLabelW = doc.getTextWidth(dateLabel) + 4;
      const maxAddrW = W - 2 * M - dateLabelW;
      const addrTruncated = doc.splitTextToSize(addressLine, maxAddrW)[0];
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(187, 152, 77);
      doc.text(addrTruncated, M, y);
      doc.setTextColor(107, 114, 128);
      doc.text(dateLabel, W - M, y, { align: "right" });
      doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.3);
      doc.line(M, y + 3, W - M, y + 3);
      y += 11;

      // ── Table header ──
      const C = { item: M, unit: 128, qty: 148, rate: 170, pay: W - M };
      const ROW_H = 9;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(153, 153, 153);
      doc.text("SCOPE ITEM", C.item, y);
      doc.text("UNIT", C.unit, y, { align: "center" });
      doc.text("QTY", C.qty, y, { align: "center" });
      doc.text("RATE", C.rate, y, { align: "right" });
      doc.text("CREW PAY", C.pay, y, { align: "right" });
      doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.6);
      doc.line(M, y + 3, W - M, y + 3);
      y += 9;

      // ── Table rows ──
      items.forEach((item: any, idx: number) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.labor_cost_per_unit) || 0;
        if (idx % 2 === 1) { doc.setFillColor(249, 250, 251); doc.rect(M, y - 6, W - 2 * M, ROW_H, "F"); }
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.setTextColor(26, 26, 26);
        doc.text(doc.splitTextToSize(item.product_name || "—", 105)[0], C.item, y);
        doc.setTextColor(26, 26, 26);
        doc.text(item.unit || "—", C.unit, y, { align: "center" });
        doc.text(qty.toLocaleString(), C.qty, y, { align: "center" });
        doc.text(rate > 0 ? fmtCur(rate) : "—", C.rate, y, { align: "right" });
        doc.setTextColor(26, 26, 26);
        doc.text(fmtCur(qty * rate), C.pay, y, { align: "right" });
        doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2);
        doc.line(M, y + 4, W - M, y + 4);
        y += ROW_H;
      });

      y += 5;

      // ── Total ──
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(58, 58, 56);
      doc.text("Total Crew Payout", M, y);
      doc.setFontSize(10); doc.setTextColor(187, 152, 77);
      doc.text(fmtCur(total), W - M, y, { align: "right" });
      y += 8;

      // ── Notes ──
      if (fio?.notes?.trim()) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(153, 153, 153);
        doc.text("NOTES", M, y); y += 5;
        doc.setFontSize(8); doc.setTextColor(58, 58, 56);
        const noteLines = doc.splitTextToSize(fio.notes, W - 2 * M);
        doc.text(noteLines, M, y); y += noteLines.length * 5 + 6;
      }

      // ── Signatures — pinned near bottom like preview's mt-auto ──
      y = Math.max(y + 14, 245);
      doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3);
      doc.line(M, y, W - M, y); y += 9;
      const sigW = (W - 2 * M - 16) / 2;
      // Left
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(55, 65, 81);
      doc.text("Butler & Associates Construction", M, y);
      doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.4);
      doc.line(M, y + 14, M + sigW, y + 14);
      doc.setFontSize(7); doc.setTextColor(107, 114, 128);
      doc.text("Authorized Signature / Date", M, y + 18);
      // Right
      const rX = M + sigW + 16;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(55, 65, 81);
      doc.text(`Crew Lead / Subcontractor${foremanName ? ` — ${foremanName}` : ""}`, rX, y);
      doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.4);
      doc.line(rX, y + 14, W - M, y + 14);
      doc.setFontSize(7); doc.setTextColor(107, 114, 128);
      doc.text("Signature / Date", rX, y + 18);

      const safeName = foremanName ? foremanName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_") : (project?.name ?? "FIO").replace(/[^a-zA-Z0-9-_]/g, "_");
      doc.save(`Field_Installation_Order_${safeName}.pdf`);
      activityLogAPI.create({ client_id: project.client?.id, action_type: "fio_pdf_exported", description: `FIO PDF exported — project: ${project.name ?? ""}` }).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF — please try again.");
    } finally {
      setExporting(false);
    }
  };

  const addItem = () => setEditItems([...editItems, { id: `new-${Date.now()}`, product_name: "", unit: "", quantity: 1, labor_cost_per_unit: 0, notes: "" }]);
  const removeItem = (idx: number) => setEditItems(editItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: string, value: any) =>
    setEditItems(editItems.map((item, i) => i === idx ? { ...item, [key]: value } : item));

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const grandTotal = (fio?.items || []).reduce(
    (sum: number, item: any) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0), 0
  );

  const editTotal = editItems.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0), 0
  );

  // Pay crew totals
  const weeklyPayout = (fio?.items || []).reduce((sum: number, item: any) => {
    const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
    const pct = completionPct[item.id] || 0;
    return sum + total * (pct / 100);
  }, 0);

  const getUpcomingSunday = () => {
    const today = new Date();
    const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
    const d = new Date(today);
    d.setDate(today.getDate() + daysUntilSunday);
    return d.toISOString().split("T")[0];
  };

  // Mark as Paid gate — all items must reach 100% and balance must be $0
  const totalCommitted = (fio?.items || []).reduce((sum: number, item: any) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0)), 0);
  const totalPaid = crewPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount_paid) || 0), 0);
  const itemCompletionMap: Record<string, number> = {};
  crewPayments.forEach((p: any) => {
    itemCompletionMap[p.fio_item_id] = (itemCompletionMap[p.fio_item_id] || 0) + (parseFloat(p.completion_pct) || 0);
  });
  const allItemsComplete = (fio?.items || []).length > 0 && (fio?.items || []).every((item: any) => (itemCompletionMap[item.id] || 0) >= 100);
  const balanceClear = totalCommitted > 0 && Math.abs(totalCommitted - totalPaid) < 0.01;
  const canMarkPaid = allItemsComplete && balanceClear;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setView("view"); setEditItems([]); setEditWorkDate(""); setCompletionPct({}); setWeekEndingDate(getUpcomingSunday()); setPayNotes(""); setReassignForemanId(""); } onOpenChange(o); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0 gap-0">

        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-3">
              {view === "pay_crew" && (
                <button onClick={() => setView("view")} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <SheetTitle>
                  {view === "pay_crew" ? "Pay Crew — Weekly Completion" : "Field Installation Order"}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="mt-0.5">
                    <p className="text-sm text-muted-foreground">{project?.name ?? "—"}</p>
                    {fio?.foreman && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {`${fio.foreman.first_name ?? ""} ${fio.foreman.last_name ?? ""}`.trim()}
                        {fio.foreman.is_active === false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactive</span>}
                      </p>
                    )}
                  </div>
                </SheetDescription>
              </div>
            </div>

            {/* Action buttons */}
            {view === "view" && fio && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Actions <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" portal={false}>
                    {can("can_approve_fio_payments") && (
                      <DropdownMenuItem onClick={() => { setView("edit"); setEditItems(fio.items || []); setEditWorkDate(fio.work_date || ""); setReassignForemanId(fio.foreman_id || ""); }}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={exportPDF} disabled={exporting}>
                      {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                      Export PDF
                    </DropdownMenuItem>
                    {can("can_approve_fio_payments") && fio.status !== "paid" && (
                      <DropdownMenuItem
                        disabled={markingComplete || !canMarkPaid}
                        title={!canMarkPaid ? "All items 100% complete & balance $0" : undefined}
                        onClick={async () => {
                          setMarkingComplete(true);
                          try {
                            const { data: { user: fioUser } } = await supabase.auth.getUser();
                            const fioNow = new Date().toISOString();
                            await fioAPI.update(fio.id, { status: "paid", paid_date: fioNow.split("T")[0], completed_by: fioUser?.id ?? null, completed_at: fioNow });
                            setFio({ ...fio, status: "paid" });
                            activityLogAPI.create({ client_id: project.client?.id, action_type: "fio_updated", description: `FIO marked as paid — project: ${project.name ?? ""}` }).catch(() => {});
                            onFioSaved?.();
                            toast.success("FIO marked as paid");
                          } catch (err: any) {
                            toast.error(err.message || "Failed to update status");
                          } finally {
                            setMarkingComplete(false);
                          }
                        }}
                      >
                        {markingComplete ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                        Mark as Paid
                      </DropdownMenuItem>
                    )}
                    {can("can_approve_fio_payments") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setShowDeleteFioConfirm(true)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete FIO
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {role !== "sales_rep" && (
                  <Button size="sm" onClick={() => { setView("pay_crew"); loadCrewPayments(fio.id); }}>
                    <DollarSign className="h-4 w-4 mr-1.5" /> Pay Crew
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>

          ) : (
          <>
          {/* Crew Navigator — arrows when 2+ FIOs, hidden during Pay Crew */}
          {view !== "pay_crew" && (fioList.length > 0 || addingCrew) && (
            <div className="sticky top-0 -mx-6 px-6 bg-background z-10 flex items-center gap-2 py-3 border-b mb-4">
              {fioList.length > 1 && (
                <button
                  onClick={() => {
                    const idx = fioList.findIndex((f: any) => f.id === fio?.id);
                    if (idx <= 0) return;
                    const prev = fioList[idx - 1];
                    setAddingCrew(false);
                    setFio(prev);
                    setEditItems(prev.items || []);
                    setEditWorkDate(prev.work_date || "");
                    setReassignForemanId("");
                    const init: Record<string, number> = {};
                    (prev.items || []).forEach((item: any) => { init[item.id] = 0; });
                    setCompletionPct(init);
                    setView("view");
                  }}
                  disabled={fioList.findIndex((f: any) => f.id === fio?.id) <= 0 || addingCrew}
                  className="p-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}

              {/* Current crew pill */}
              {!addingCrew && fio && (() => {
                const idx = fioList.findIndex((f: any) => f.id === fio.id);
                const foremanName = fio.foreman
                  ? `${fio.foreman.first_name ?? ""} ${fio.foreman.last_name ?? ""}`.trim()
                  : `Crew ${idx + 1}`;
                return (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary">
                      {foremanName}
                    </span>
                    {fioList.length > 1 && (
                      <span className="text-xs text-muted-foreground">{idx + 1} / {fioList.length}</span>
                    )}
                  </div>
                );
              })()}

              {/* Adding crew state pill */}
              {addingCrew && (
                <div className="flex-1">
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary">
                    + New Crew
                  </span>
                </div>
              )}

              {fioList.length > 1 && (
                <button
                  onClick={() => {
                    const idx = fioList.findIndex((f: any) => f.id === fio?.id);
                    if (idx >= fioList.length - 1) return;
                    const next = fioList[idx + 1];
                    setAddingCrew(false);
                    setFio(next);
                    setEditItems(next.items || []);
                    setEditWorkDate(next.work_date || "");
                    setReassignForemanId("");
                    const init: Record<string, number> = {};
                    (next.items || []).forEach((item: any) => { init[item.id] = 0; });
                    setCompletionPct(init);
                    setView("view");
                  }}
                  disabled={fioList.findIndex((f: any) => f.id === fio?.id) >= fioList.length - 1 || addingCrew}
                  className="p-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {can("can_approve_fio_payments") && fio && !addingCrew && crewPayments.length === 0 && (
                <button
                  disabled={removingCrew}
                  onClick={() => setRemoveCrewTarget(fio)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors border-red-200 text-red-500 hover:border-red-400 hover:text-red-700 disabled:opacity-40"
                >
                  {removingCrew ? "Removing…" : "Remove Crew"}
                </button>
              )}
              {can("can_approve_fio_payments") && (
                <button
                  onClick={() => {
                    setAddingCrew(true);
                    setFio(null);
                    setNewCrewForemanId("");
                    setEditItems([]);
                    setEditWorkDate("");
                    setCheckedIds(new Set());
                    fetchLaborFromEstimate().then((items) => {
                      const assignedNames = new Set(
                        fioList.flatMap((f: any) => (f.items || []).map((i: any) => i.product_name))
                      );
                      setSuggestedItems(items.filter((item: any) => !assignedNames.has(item.product_name)));
                    });
                    setView("edit");
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  + Add Crew
                </button>
              )}
            </div>
          )}

          {/* Foreman picker for new crew */}
          {addingCrew && view === "edit" && (
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium shrink-0">Assign Foreman <span className="text-destructive">*</span></label>
              <select
                value={newCrewForemanId}
                onChange={(e) => setNewCrewForemanId(e.target.value)}
                className={`h-8 rounded-md border bg-background px-2 text-sm flex-1 ${!newCrewForemanId ? "border-amber-400" : "border-input"}`}
              >
                <option value="">— select foreman —</option>
                {foremen.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.first_name} {f.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {view === "edit" ? (
            /* ── Edit / Create Mode ── */
            <div className="space-y-4">
              {/* Foreman — locked once any crew payment exists (regardless of fio.status) */}
              {fio && (
                crewPayments.length > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span className="font-medium">
                      {foremen.find((f: any) => f.id === fio.foreman_id)
                        ? `${foremen.find((f: any) => f.id === fio.foreman_id).first_name} ${foremen.find((f: any) => f.id === fio.foreman_id).last_name}`
                        : "Crew Foreman"}
                    </span>
                    {" "}— Payments recorded under this foreman. Use <strong>+ Add Crew</strong> to assign additional crew.
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium shrink-0">Crew Foreman</label>
                    <select
                      value={reassignForemanId}
                      onChange={(e) => setReassignForemanId(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1"
                    >
                      <option value="">— select foreman —</option>
                      {foremen.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.first_name} {f.last_name}</option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {/* Work Date */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium shrink-0">Work Date</label>
                <input
                  type="date"
                  value={editWorkDate}
                  onChange={(e) => setEditWorkDate(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              {!fio && suggestedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Suggested labor items from proposal — select which to include:</p>
                  {suggestedItems.map((item) => {
                    const checked = checkedIds.has(item.id);
                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}
                        onClick={() => {
                          const next = new Set(checkedIds);
                          if (checked) { next.delete(item.id); setEditItems(editItems.filter((e) => e.id !== item.id)); }
                          else { next.add(item.id); setEditItems([...editItems, { ...item }]); }
                          setCheckedIds(next);
                        }}
                      >
                        <input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-primary pointer-events-none" />
                        <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                        <span className="text-xs font-semibold">{formatCurrency(item.labor_cost_per_unit)}/unit</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!fio && suggestedItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No labor items found in the proposal. Add items manually below.</p>
              )}
              {editItems.length > 0 && (
                <div className="border rounded-lg">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[40%]">Service / Product</th>
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[15%]">Unit</th>
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[15%]">Qty</th>
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[20%]">$/Unit</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className={`border-b last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"} ${itemErrors[idx] ? "ring-1 ring-inset ring-red-300" : ""}`}>
                          <td className="px-2 py-1.5">
                            <div className="relative">
                              <Input
                                value={item.product_name}
                                autoComplete="off"
                                onFocus={() => setProductDropdownOpen(item.id)}
                                onBlur={() => setTimeout(() => setProductDropdownOpen(null), 150)}
                                onChange={(e) => { updateItem(idx, "product_name", e.target.value); setProductDropdownOpen(item.id); setItemErrors((p) => { const n = { ...p }; delete n[idx]; return n; }); }}
                                className={`h-8 text-sm ${itemErrors[idx] && !item.product_name.trim() ? "border-red-400" : ""}`}
                                placeholder="e.g., Labor — Concrete Pour"
                              />
                              {productDropdownOpen === item.id && (() => {
                                const filtered = allProducts.filter((p: any) =>
                                  !item.product_name.trim() || p.name.toLowerCase().includes(item.product_name.toLowerCase())
                                );
                                if (!filtered.length) return null;
                                return (
                                  <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-background border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                    {filtered.map((p: any) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        className="w-full text-left px-2.5 py-2 hover:bg-accent/60 transition-colors border-b last:border-0"
                                        onMouseDown={() => {
                                          setEditItems((prev) => prev.map((it, i) => i !== idx ? it : {
                                            ...it,
                                            product_name: p.name,
                                            ...(p.unit ? { unit: p.unit } : {}),
                                            labor_cost_per_unit: p.labor_cost ?? 0,
                                          }));
                                          setProductDropdownOpen(null);
                                          setItemErrors((prev) => { const n = { ...prev }; delete n[idx]; return n; });
                                        }}
                                      >
                                        <p className="text-xs font-medium leading-tight">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">{[p.category?.name, p.unit].filter(Boolean).join(" · ")}</p>
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={item.unit}
                              onChange={(e) => { updateItem(idx, "unit", e.target.value); setItemErrors((p) => { const n = { ...p }; delete n[idx]; return n; }); }}
                              className={`h-8 w-full rounded-md border bg-background px-2 text-sm ${itemErrors[idx] && !item.unit.trim() ? "border-red-400" : "border-input"}`}
                            >
                              <option value="">— select —</option>
                              {units.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" value={item.labor_cost_per_unit} onChange={(e) => updateItem(idx, "labor_cost_per_unit", e.target.value)} className="h-8 text-sm" />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRemoveItemTarget(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!addingCrew && (() => {
                const remaining = suggestedItems.filter(
                  (s: any) => !editItems.some((e: any) => e.product_name === s.product_name)
                );
                return remaining.length > 0 ? (
                  <select
                    value=""
                    className="h-8 text-sm rounded-md border border-input bg-background px-2 max-w-[260px]"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const s = remaining.find((x: any) => x.id === e.target.value);
                      if (s) setEditItems((prev) => [...prev, { ...s, id: `new-${Date.now()}` }]);
                    }}
                  >
                    <option value="">+ Add from proposal…</option>
                    {remaining.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.product_name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">All proposal labor items added.</p>
                );
              })()}
              {Object.keys(itemErrors).length > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {Object.values(itemErrors)[0]} — highlighted rows above.
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">Total: {formatCurrency(editTotal)}</span>
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add Item
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setItemErrors({}); setView("view"); if (!fio) onOpenChange(false); }}>
                    <X className="h-4 w-4 mr-1.5" /> Cancel
                  </Button>
                  {role !== "sales_rep" && (
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                      {fio ? "Save Changes" : "Create FIO"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

          ) : view === "pay_crew" ? (
            /* ── Pay Crew ── */
            <div className="space-y-5">

              {/* Week ending date */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium shrink-0">Week Ending</label>
                <input
                  type="date"
                  value={weekEndingDate}
                  onChange={(e) => setWeekEndingDate(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              {/* Line items table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-900 text-white text-xs font-semibold">
                  <div className="col-span-4">Scope Item</div>
                  <div className="col-span-2 text-center">Total Pay</div>
                  <div className="col-span-2 text-center">Paid to Date</div>
                  <div className="col-span-2 text-center">This Week %</div>
                  <div className="col-span-2 text-right">This Week $</div>
                </div>
                {(fio?.items || []).map((item: any, idx: number) => {
                  const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
                  const paidPct = crewPayments
                    .filter((p) => p.fio_item_id === item.id)
                    .reduce((s, p) => s + (p.completion_pct || 0), 0);
                  const paidAmt = crewPayments
                    .filter((p) => p.fio_item_id === item.id)
                    .reduce((s, p) => s + (p.amount_paid || 0), 0);
                  const remainingPct = Math.max(0, 100 - paidPct);
                  const pct = completionPct[item.id] || 0;
                  const weekAmt = total * (pct / 100);
                  return (
                    <div key={item.id} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
                        <div className="col-span-4 font-medium truncate">{item.product_name}</div>
                        <div className="col-span-2 text-center text-xs text-muted-foreground">{formatCurrency(total)}</div>
                        <div className="col-span-2 text-center">
                          <span className={`text-xs font-semibold ${paidPct >= 100 ? "text-green-600" : paidPct > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {paidPct.toFixed(0)}% · {formatCurrency(paidAmt)}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          {paidPct >= 100 ? (
                            <span className="text-xs text-green-600 font-medium">Fully paid</span>
                          ) : (
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                max={remainingPct}
                                className="h-8 text-sm text-center pr-5"
                                value={pct || ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.min(remainingPct, Math.max(0, parseFloat(e.target.value) || 0));
                                  setCompletionPct((prev) => ({ ...prev, [item.id]: val }));
                                }}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                            </div>
                          )}
                        </div>
                        <div className={`col-span-2 text-right font-semibold ${weekAmt > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {formatCurrency(weekAmt)}
                        </div>
                      </div>
                      {/* Cumulative progress bar */}
                      <div className="px-4 pb-2">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(paidPct + pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Crew Balance Summary */}
              {(() => {
                const totalCommitted = (fio?.items || []).reduce((s: number, item: any) =>
                  s + (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0), 0);
                const totalPaid = crewPayments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);
                const remaining = Math.max(0, totalCommitted - totalPaid);
                return totalCommitted > 0 ? (
                  <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/30 text-center">
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Committed</p>
                      <p className="text-sm font-semibold">{formatCurrency(totalCommitted)}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Paid to Date</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Remaining</p>
                      <p className="text-sm font-semibold text-amber-600">{formatCurrency(remaining)}</p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              {/* Payout total + Record button */}
              <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-5 py-4">
                <span className="font-bold tracking-wide text-sm">WEEKLY CREW PAYOUT</span>
                <span className="text-lg font-bold text-[#C9A84C]">{formatCurrency(weeklyPayout)}</span>
              </div>

              <Button
                className="w-full bg-black hover:bg-gray-800 text-white"
                onClick={handleRecordPayment}
                disabled={recording || weeklyPayout === 0}
              >
                {recording ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                Record Payment
              </Button>

              {/* Payment history */}
              {loadingPayments ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : crewPayments.length > 0 && (() => {
                // Group by week_ending_date
                const weeks = [...new Set(crewPayments.map((p) => p.week_ending_date))];
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment History</p>
                    {weeks.map((week) => {
                      const weekEntries = crewPayments.filter((p) => p.week_ending_date === week);
                      const weekTotal = weekEntries.reduce((s, p) => s + (p.amount_paid || 0), 0);
                      const recorder = weekEntries[0]?.paidBy;
                      return (
                        <div key={week} className="border rounded-lg overflow-hidden opacity-75">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 text-xs font-semibold">
                            <span>Week ending {new Date(week + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <div className="flex items-center gap-3">
                              {recorder && <span className="text-muted-foreground">by {recorder.first_name} {recorder.last_name}</span>}
                              <span className="text-green-700">{formatCurrency(weekTotal)}</span>
                            </div>
                          </div>
                          {weekEntries.map((p) => (
                            <div key={p.id} className="flex items-center justify-between px-4 py-1.5 text-xs border-t text-muted-foreground">
                              <span>{p.fio_item_id ? (fio?.items || []).find((i: any) => i.id === p.fio_item_id)?.product_name ?? "—" : "—"}</span>
                              <span>{p.completion_pct}% · {formatCurrency(p.amount_paid)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          ) : !fio ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileDown className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No FIO created yet</p>
              <p className="text-xs mt-1">An admin will create the Field Installation Order for this project.</p>
            </div>
          ) : (
            /* ── View Mode — document preview ── */
            <div className="bg-gray-100 rounded-lg p-4">
              {/* Paper card — A4 proportions, full-bleed header */}
              <div id="fio-preview-content" className="bg-white shadow-lg w-full font-sans text-[13px] flex flex-col min-h-[1050px]">

                {/* Header — full bleed edge to edge */}
                <div className="bg-[#0A0A0A] px-8 py-5 flex justify-between items-start flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <img src={baLogoUrl} alt="Butler & Associates" className="h-11 w-auto flex-shrink-0" />
                    <div>
                      <div className="text-[15px] font-medium text-white mb-1">Butler &amp; Associates Construction, Inc.</div>
                      <div className="text-[10px] text-white/60 mb-0.5">6275 University Drive NW, Suite 37-314, Huntsville, AL 35806</div>
                      <div className="text-[10px] text-white/60">(256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[9px] font-medium tracking-[0.18em] uppercase text-[#BB984D]">Field Installation Order</div>
                  </div>
                </div>
                <div className="h-[2px] flex-shrink-0" style={{ background: "linear-gradient(90deg, #BB984D, #8A7040)" }} />

                {/* Body content */}
                <div className="flex-1 px-8 pt-5 space-y-5">
                  {/* Project / Date */}
                  <div className="flex items-start justify-between gap-4 border-b border-gray-300 pb-3">
                    <span className="text-[#C9A84C] text-sm font-medium min-w-0 break-words">
                      {[project?.client?.address, project?.client?.city, project?.client?.state, project?.client?.zip].filter(Boolean).join(", ") || project?.name || "—"}
                    </span>
                    <span className="text-sm text-gray-600 flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                      {`Work Date: ${
                        project?.start_date && project?.end_date
                          ? `${new Date(project.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(project.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                          : project?.start_date
                          ? new Date(project.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                          : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      }`}
                    </span>
                  </div>

                  {/* Items table */}
                  <div>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-white border-b-2 border-gray-200">
                          <th className="py-2.5 px-3 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Scope Item</th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide w-14">Unit</th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide w-12">Qty</th>
                          <th className="py-2.5 px-3 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wide w-20">Rate</th>
                          <th className="py-2.5 px-3 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wide w-24">Crew Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(fio?.items || []).map((item: any, idx: number) => {
                          const qty = parseFloat(item.quantity) || 0;
                          const rate = parseFloat(item.labor_cost_per_unit) || 0;
                          return (
                            <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                              <td className="py-3 px-3">{item.product_name}</td>
                              <td className="py-3 px-3 text-center">{item.unit}</td>
                              <td className="py-3 px-3 text-center">{qty.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right tabular-nums">{rate > 0 ? formatCurrency(rate) : "—"}</td>
                              <td className="py-3 px-3 text-right font-medium tabular-nums">{formatCurrency(qty * rate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Total row */}
                  <div className="flex items-center justify-between pt-1 px-1">
                    <span className="text-sm font-medium tracking-wide text-gray-700">Total Crew Payout</span>
                    <span className="text-base font-medium text-[#BB984D] tabular-nums">{formatCurrency(grandTotal)}</span>
                  </div>

                  {fio?.notes && (
                    <div>
                      <div className="font-medium text-sm mb-1">Notes</div>
                      <p className="text-xs text-gray-600 leading-relaxed">{fio.notes}</p>
                    </div>
                  )}
                </div>

                {/* Signatures — pinned to bottom */}
                <div className="mt-auto px-8 pt-6 pb-16">
                  <div className="border-t border-gray-300 mb-4" />
                  <div className="grid grid-cols-2 gap-10">
                    <div>
                      <div className="text-xs text-gray-700 mb-10">Butler &amp; Associates Construction</div>
                      <div className="border-b border-gray-300 mb-1" />
                      <div className="text-[11px] text-gray-500">Authorized Signature / Date</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-700 mb-10">
                        Crew Lead / Subcontractor
                        {fio?.foreman ? ` — ${fio.foreman.first_name ?? ""} ${fio.foreman.last_name ?? ""}`.trim() : ""}
                      </div>
                      <div className="border-b border-gray-300 mb-1" />
                      <div className="text-[11px] text-gray-500">Signature / Date</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={removeItemTarget !== null} onOpenChange={(o) => { if (!o) setRemoveItemTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeItemTarget !== null && editItems[removeItemTarget]
                ? <>Remove <span className="font-medium text-foreground">"{editItems[removeItemTarget].product_name || "this item"}"</span> from the list? This won't be permanent until you save.</>
                : "Remove this item from the list?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (removeItemTarget !== null) { removeItem(removeItemTarget); setRemoveItemTarget(null); } }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeCrewTarget} onOpenChange={(o) => { if (!o) setRemoveCrewTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Crew?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{removeCrewTarget?.foreman ? `${removeCrewTarget.foreman.first_name} ${removeCrewTarget.foreman.last_name}` : "this crew"}</strong> from the Field Installation Order, including all their line items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingCrew}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removingCrew}
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                setRemovingCrew(true);
                try {
                  await fioAPI.delete(removeCrewTarget.id);
                  activityLogAPI.create({ client_id: project.client?.id, action_type: "fio_updated", description: `Crew removed from FIO — project: ${project.name ?? ""}` }).catch(() => {});
                  toast.success("Crew removed");
                  onFioSaved?.();
                  setRemoveCrewTarget(null);
                  loadFIO();
                } catch {
                  toast.error("Failed to remove crew — please try again.");
                } finally {
                  setRemovingCrew(false);
                }
              }}
            >
              {removingCrew ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove Crew
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteFioConfirm} onOpenChange={(o) => { if (!o) setShowDeleteFioConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field Installation Order?</AlertDialogTitle>
            <AlertDialogDescription>
              {(fio?.status === "paid" || fio?.status === "partial_paid" || totalPaid > 0)
                ? <>This FIO has <strong>${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong> in crew payments already recorded. Deleting it will permanently remove the FIO and all payment history. This cannot be undone.</>
                : <>This will permanently delete the FIO and all its line items. This cannot be undone.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!fio) return;
                setDeletingFio(true);
                try {
                  await fioAPI.delete(fio.id);
                  activityLogAPI.create({ client_id: project.client?.id, action_type: "fio_updated", description: `FIO deleted — project: ${project.name ?? ""}` }).catch(() => {});
                  toast.success("FIO deleted");
                  onFioSaved?.();
                  onOpenChange(false);
                } catch (err: any) {
                  toast.error(err.message || "Failed to delete FIO");
                } finally {
                  setDeletingFio(false);
                  setShowDeleteFioConfirm(false);
                }
              }}
            >
              {deletingFio ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete FIO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
