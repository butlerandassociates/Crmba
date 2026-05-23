import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { X, Plus, Trash2, Edit2, Save, ChevronDown, ChevronRight, TrendingUp, Loader2, Receipt, BarChart2 } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { overheadAPI } from "../api/overhead";
import type { OverheadCost } from "../api/overhead";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "../hooks/usePermissions";
import { toast } from "sonner";
import { formatCurrency } from "@/app/utils/format";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1"];

const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

interface OverheadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRevenue: number;
  grossProfit: number;
}

function isInMonth(item: OverheadCost, year: number, month: number): boolean {
  const d = new Date(item.date + "T00:00:00");
  const iy = d.getFullYear();
  const im = d.getMonth() + 1;
  if (!item.is_recurring) return iy === year && im === month;
  if (iy > year || (iy === year && im > month)) return false;
  const freq = item.recurring_frequency ?? "monthly";
  if (freq === "monthly") return true;
  if (freq === "quarterly") return ((year - iy) * 12 + (month - im)) % 3 === 0;
  return im === month; // yearly
}

export function OverheadModal({ open, onOpenChange, totalRevenue, grossProfit }: OverheadModalProps) {
  const { can } = usePermissions();
  const canEdit = can("can_edit_financials");

  const [items, setItems] = useState<OverheadCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState(CURRENT_MONTH);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showROI, setShowROI] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editFrequency, setEditFrequency] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [editDate, setEditDate] = useState(TODAY);
  const [savingEdit, setSavingEdit] = useState(false);

  // New item state
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newFrequency, setNewFrequency] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [newDate, setNewDate] = useState(TODAY);
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<OverheadCost | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ROI data
  const [leadSourceData, setLeadSourceData] = useState<Record<string, { revenue: number; count: number }>>({});
  const [roiLoaded, setRoiLoaded] = useState(false);
  const [roiLoading, setRoiLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await overheadAPI.getAll());
    } catch {
      toast.error("Failed to load overhead costs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const loadROI = async () => {
    if (roiLoaded) return;
    setRoiLoading(true);
    try {
      const { data } = await supabase
        .from("projects")
        .select("total_value, clients(lead_sources!lead_source_id(name))")
        .in("status", ["sold", "active", "completed"]);
      const grouped: Record<string, { revenue: number; count: number }> = {};
      (data ?? []).forEach((p: any) => {
        const ls = (p.clients?.lead_sources?.name as string | null) || "Unknown";
        if (!grouped[ls]) grouped[ls] = { revenue: 0, count: 0 };
        grouped[ls].revenue += Number(p.total_value) || 0;
        grouped[ls].count += 1;
      });
      setLeadSourceData(grouped);
      setRoiLoaded(true);
    } catch {
      toast.error("Failed to load ROI data");
    } finally {
      setRoiLoading(false);
    }
  };

  useEffect(() => {
    if (open && showROI) loadROI();
  }, [open, showROI]);

  // ── Derived data ──────────────────────────────────────────────
  const [fy, fm] = dateFilter.split("-").map(Number);
  const visible = items.filter((i) => isInMonth(i, fy, fm));
  const roots = visible.filter((i) => !i.parent_id);
  const getChildren = (pid: string) => visible.filter((i) => i.parent_id === pid);
  const allChildren = (pid: string) => items.filter((i) => i.parent_id === pid);

  const totalOverhead = visible.reduce((s, i) => s + i.amount, 0);
  const trueGrossProfit = grossProfit - totalOverhead;
  const overheadPct = totalRevenue > 0 ? ((totalOverhead / totalRevenue) * 100).toFixed(1) : "0.0";
  const trueGrossPct = totalRevenue > 0 ? ((trueGrossProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const chartData = roots
    .map((r) => {
      const childTotal = getChildren(r.id).reduce((s, c) => s + c.amount, 0);
      return { name: r.name, value: r.amount + childTotal };
    })
    .filter((d) => d.value > 0);

  // Marketing ROI matching — exact match first, then partial
  const findLeadSource = (channelName: string) => {
    const entries = Object.entries(leadSourceData);
    const lower = channelName.toLowerCase().trim();
    // 1. Exact (case-insensitive)
    const exact = entries.find(([ls]) => ls.toLowerCase().trim() === lower);
    if (exact) return exact;
    // 2. Partial — require meaningful word overlap (min 4 chars)
    return entries.find(([ls]) => {
      const lsLower = ls.toLowerCase().trim();
      return lsLower.includes(lower) || lower.includes(lsLower) ||
        lower.split(" ").some((w) => w.length > 4 && lsLower.includes(w));
    });
  };

  const marketingRoot = roots.find((r) => r.name.toLowerCase().includes("marketing"));
  const marketingChannels = marketingRoot ? getChildren(marketingRoot.id) : [];

  const roiCards = marketingChannels
    .map((ch) => {
      const match = findLeadSource(ch.name);
      if (!match) return null;
      const [ls, lsData] = match;
      const roi = ch.amount > 0 ? ((lsData.revenue - ch.amount) / ch.amount) * 100 : null;
      return { channel: ch.name, leadSource: ls, cost: ch.amount, revenue: lsData.revenue, jobs: lsData.count, roi };
    })
    .filter(Boolean) as { channel: string; leadSource: string; cost: number; revenue: number; jobs: number; roi: number | null }[];

  // ── Handlers ─────────────────────────────────────────────────
  const close = () => {
    setEditingId(null);
    setNewName(""); setNewAmount(""); setNewIsRecurring(false); setNewParentId(null);
    onOpenChange(false);
  };

  const startEdit = (item: OverheadCost) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(String(item.amount));
    setEditIsRecurring(item.is_recurring);
    setEditFrequency(item.recurring_frequency ?? "monthly");
    setEditDate(item.date);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editAmount) { toast.error("Name and amount are required"); return; }
    setSavingEdit(true);
    try {
      const updated = await overheadAPI.update(editingId, {
        name: editName.trim(),
        amount: parseFloat(editAmount) || 0,
        is_recurring: editIsRecurring,
        recurring_frequency: editIsRecurring ? editFrequency : null,
        date: editDate,
      });
      setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      setEditingId(null);
      toast.success("Item updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim() || !newAmount) { toast.error("Name and amount are required"); return; }
    setSavingNew(true);
    try {
      const saved = await overheadAPI.create({
        name: newName.trim(),
        amount: parseFloat(newAmount) || 0,
        is_recurring: newIsRecurring,
        recurring_frequency: newIsRecurring ? newFrequency : null,
        date: newDate,
        parent_id: newParentId,
      });
      setItems((prev) => [...prev, saved]);
      if (newParentId) setExpandedIds((prev) => new Set([...prev, newParentId!]));
      setNewName(""); setNewAmount(""); setNewIsRecurring(false); setNewParentId(null);
      toast.success("Overhead item added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add item");
    } finally {
      setSavingNew(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await overheadAPI.delete(deleteTarget.id);
      const childIds = new Set(items.filter((i) => i.parent_id === deleteTarget.id).map((i) => i.id));
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id && !childIds.has(i.id)));
      toast.success("Item deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // ── Render helpers ────────────────────────────────────────────
  const renderCostItem = (item: OverheadCost, level = 0) => {
    const children = getChildren(item.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(item.id);
    const childTotal = children.reduce((s, c) => s + c.amount, 0);
    const totalWithChildren = item.amount + childTotal;
    const isEditing = editingId === item.id;
    const pct = totalOverhead > 0 ? ((totalWithChildren / totalOverhead) * 100).toFixed(1) : "0.0";

    return (
      <div key={item.id}>
        <div className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 ${level > 0 ? "ml-8" : ""}`}>
          {hasChildren && (
            <button onClick={() => toggleExpand(item.id)} className="p-1 hover:bg-gray-200 rounded transition-colors shrink-0">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-600" /> : <ChevronRight className="w-4 h-4 text-gray-600" />}
            </button>
          )}

          {isEditing ? (
            <>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Item name"
              />
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Amount"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 shrink-0">
                <input type="checkbox" checked={editIsRecurring} onChange={(e) => setEditIsRecurring(e.target.checked)} className="rounded" />
                Recurring
              </label>
              {editIsRecurring && (
                <select
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value as "monthly" | "quarterly" | "yearly")}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shrink-0"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditingId(null)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors shrink-0">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                  {item.is_recurring ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded shrink-0">
                      {item.recurring_frequency ?? "monthly"}
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded shrink-0">one-time</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{pct}% of overhead • {item.date}</p>
              </div>
              <p className="font-semibold text-gray-900 text-sm shrink-0">{formatCurrency(totalWithChildren)}</p>
              {canEdit && (
                <>
                  {!hasChildren && (
                    <button onClick={() => startEdit(item)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors shrink-0">
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(item)}
                    disabled={deletingId === item.id}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors shrink-0"
                  >
                    {deletingId === item.id
                      ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      : <Trash2 className="w-4 h-4 text-red-600" />}
                  </button>
                  {level === 0 && (
                    <button
                      onClick={() => {
                        setNewParentId(item.id);
                        setExpandedIds((prev) => new Set([...prev, item.id]));
                      }}
                      className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors shrink-0"
                      title="Add subcategory"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-2 space-y-2">
            {children.map((c) => renderCostItem(c, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const parentName = newParentId ? (items.find((i) => i.id === newParentId)?.name ?? "Category") : null;

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">

          {/* Sticky header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Overhead Costs</h2>
              <p className="text-sm text-gray-500 mt-1">Monthly overhead breakdown and analysis with ROI tracking</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Date Filter:</label>
                <input
                  type="month"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <button onClick={close} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium mb-1">Total Revenue</p>
                    <p className="text-xl font-bold text-blue-900">{formatCurrency(totalRevenue)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 font-medium mb-1">Gross Profit</p>
                    <p className="text-xl font-bold text-green-900">{formatCurrency(grossProfit)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <p className="text-sm text-orange-700 font-medium mb-1">Total Overhead</p>
                    <p className="text-xl font-bold text-orange-900">{formatCurrency(totalOverhead)}</p>
                    <p className="text-xs text-orange-600 mt-1">{overheadPct}% of revenue</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-sm text-purple-700 font-medium mb-1">True Gross Profit</p>
                    <p className="text-xl font-bold text-purple-900">{formatCurrency(trueGrossProfit)}</p>
                    <p className="text-xs text-purple-600 mt-1">{trueGrossPct}% of revenue</p>
                  </div>
                </div>

                {/* Main grid: 2/3 items + 1/3 chart */}
                <div className="grid grid-cols-3 gap-8">
                  {/* Left: Overhead items */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Overhead Items</h3>
                      <button
                        onClick={() => setShowROI((v) => !v)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                      >
                        <TrendingUp className="w-4 h-4" />
                        {showROI ? "Hide" : "Show"} Marketing ROI
                      </button>
                    </div>

                    {roots.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-14 border border-dashed border-gray-300 rounded-lg mb-6">
                        <Receipt className="h-10 w-10 mb-3 text-gray-300" />
                        <p className="text-sm font-semibold text-gray-700">No overhead costs for this month</p>
                        <p className="text-xs mt-1 text-gray-400">Add your first expense below to start tracking true profit.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 mb-6">
                        {roots.map((r) => renderCostItem(r))}
                      </div>
                    )}

                    {/* Add new item */}
                    {canEdit && (
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          {parentName ? `Add to ${parentName}` : "Add New Overhead Item"}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddNew(); }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="e.g., Google Ads, Utilities, Software, etc."
                            />
                            <input
                              type="number"
                              value={newAmount}
                              onChange={(e) => setNewAmount(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddNew(); }}
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="Amount"
                            />
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={newIsRecurring}
                                onChange={(e) => setNewIsRecurring(e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-gray-700">Recurring Cost</span>
                            </label>
                            {newIsRecurring && (
                              <select
                                value={newFrequency}
                                onChange={(e) => setNewFrequency(e.target.value as "monthly" | "quarterly" | "yearly")}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                              </select>
                            )}
                            <input
                              type="date"
                              value={newDate}
                              onChange={(e) => setNewDate(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            {newParentId && (
                              <button
                                onClick={() => setNewParentId(null)}
                                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                              >
                                Cancel Subcategory
                              </button>
                            )}
                            <button
                              onClick={handleAddNew}
                              disabled={savingNew || !newName || !newAmount}
                              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              {savingNew ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Chart + Profit Analysis */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Distribution</h3>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6">
                      {chartData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[250px]">
                          <BarChart2 className="h-10 w-10 mb-3 text-gray-200" />
                          <p className="text-sm font-semibold text-gray-500">No data for this month</p>
                          <p className="text-xs mt-1 text-gray-400 text-center">Add overhead items to see distribution.</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                              outerRadius={80}
                              dataKey="value"
                            >
                              {chartData.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => formatCurrency(v as number)} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Profit Analysis */}
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Profit Analysis</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Revenue</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Gross Profit (before overhead)</span>
                          <span className="font-semibold text-green-600">{formatCurrency(grossProfit)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Total Overhead</span>
                          <span className="font-semibold text-orange-600">-{formatCurrency(totalOverhead)}</span>
                        </div>
                        <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
                          <span className="font-semibold text-gray-900">True Gross Profit</span>
                          <span className="font-bold text-purple-600 text-lg">{formatCurrency(trueGrossProfit)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Marketing ROI section */}
                {showROI && (
                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Channel ROI Analysis</h3>
                    {roiLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : roiCards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-300 rounded-lg">
                        <TrendingUp className="h-10 w-10 mb-3 text-gray-300" />
                        <p className="text-sm font-semibold text-gray-700">No marketing ROI data available</p>
                        <p className="text-xs mt-1.5 text-center max-w-sm text-gray-400">
                          Add a <span className="font-medium text-gray-600">"Marketing"</span> category with subcategories named after your lead sources —{" "}
                          <span className="font-medium text-gray-600">Google LSA, Facebook, Yelp, Nextdoor</span> — to see ROI.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          {roiCards.map((card) => (
                            <div key={card.channel} className="bg-white rounded-lg border-2 border-purple-200 p-4">
                              <h4 className="font-semibold text-gray-900 mb-3 text-sm">{card.channel}</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Cost:</span>
                                  <span className="font-medium text-gray-900">{formatCurrency(card.cost)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Revenue Generated:</span>
                                  <span className="font-medium text-green-600">{formatCurrency(card.revenue)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Jobs Won:</span>
                                  <span className="font-medium text-gray-900">{card.jobs}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-2 flex justify-between">
                                  <span className="font-semibold text-gray-900">ROI:</span>
                                  <span className={`font-bold text-lg ${card.roi !== null && card.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {card.roi !== null ? `${card.roi.toFixed(0)}%` : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={roiCards}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="channel" fontSize={12} />
                              <YAxis fontSize={12} />
                              <Tooltip formatter={(v) => formatCurrency(v as number)} />
                              <Legend />
                              <Bar dataKey="cost" fill="#f59e0b" name="Marketing Cost" isAnimationActive={false} />
                              <Bar dataKey="revenue" fill="#10b981" name="Revenue Generated" isAnimationActive={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Overhead Item</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>
              {deleteTarget && allChildren(deleteTarget.id).length > 0 && (
                <> and its <span className="font-medium text-foreground">{allChildren(deleteTarget.id).length} subcategories</span></>
              )}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
