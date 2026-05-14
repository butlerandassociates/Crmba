import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Receipt, ArrowUpDown, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { receiptsAPI } from "../api/receipts";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const fmtDate = (d: string) =>
  new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type SortKey = "date" | "amount" | "client" | "name" | "gp";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

// Identical colgroup shared across all 3 tables so columns stay aligned
const COLS = (
  <colgroup>
    <col className="w-[15%]" />
    <col className="w-[13%]" />
    <col className="w-[21%]" />
    <col className="w-[14%]" />
    <col className="w-[11%]" />
    <col className="w-[14%]" />
    <col className="w-[12%]" />
  </colgroup>
);

export function CostAttributionsAll() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    receiptsAPI.getAll()
      .then(setReceipts)
      .catch(() => toast.error("Failed to load cost attributions"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [search, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  };

  const filtered = receipts.filter((r) => {
    const clientName = `${r.project?.client?.first_name ?? ""} ${r.project?.client?.last_name ?? ""}`.trim().toLowerCase();
    const q = search.toLowerCase();
    return !q || clientName.includes(q) || r.name?.toLowerCase().includes(q) || r.project?.name?.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "date")   return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sort.key === "amount") return dir * (a.amount - b.amount);
    if (sort.key === "client") {
      const an = `${a.project?.client?.first_name ?? ""} ${a.project?.client?.last_name ?? ""}`.trim();
      const bn = `${b.project?.client?.first_name ?? ""} ${b.project?.client?.last_name ?? ""}`.trim();
      return dir * an.localeCompare(bn);
    }
    if (sort.key === "name") return dir * (a.name ?? "").localeCompare(b.name ?? "");
    if (sort.key === "gp") {
      const ag = a.gp_pct ?? -Infinity;
      const bg = b.gp_pct ?? -Infinity;
      return dir * (ag - bg);
    }
    return 0;
  });

  const totalAmount = filtered.reduce((s, r) => s + (r.amount || 0), 0);
  const totalPages  = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortBtn = ({ col, label, right }: { col: SortKey; label: string; right?: boolean }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 hover:text-foreground transition-colors ${right ? "justify-end w-full" : ""}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sort.key === col ? "text-foreground" : "opacity-40"}`} />
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Sticky header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b bg-background space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Cost Attributions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">All material receipts across all clients</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{fmt(totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{filtered.length} receipts</p>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search by client, receipt name, or project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-gray-400 focus:ring-0"
        />
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
        <div className="flex-1 overflow-hidden border rounded-lg flex flex-col">

          {/* Fixed thead */}
          <table className="w-full text-sm table-fixed shrink-0">
            {COLS}
            <thead className="bg-[#f1f3f5]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground border-b">
                  <SortBtn col="client" label="Client" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground border-b">Uploaded By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground border-b">
                  <SortBtn col="name" label="Receipt Name" />
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground border-b whitespace-nowrap">
                  <SortBtn col="gp" label="Active / Projected" right />
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground border-b">
                  <SortBtn col="amount" label="Amount" right />
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground border-b">
                  <SortBtn col="date" label="Date" right />
                </th>
                <th className="px-4 py-3 border-b" />
              </tr>
            </thead>
          </table>

          {/* Scrollable rows — overflow-y-scroll keeps gutter reserved so columns stay aligned with thead */}
          <div className="flex-1 overflow-y-scroll overflow-x-hidden">
            <table className="w-full text-sm table-fixed">
              {COLS}
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">Loading...</td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      {search ? "No receipts match your search" : "No receipts yet"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((r, i) => {
                    const clientName   = `${r.project?.client?.first_name ?? ""} ${r.project?.client?.last_name ?? ""}`.trim() || "—";
                    const clientId     = r.project?.client?.id;
                    const uploaderName = r.uploader ? `${r.uploader.first_name ?? ""} ${r.uploader.last_name ?? ""}`.trim() : "—";
                    const gp           = r.gp_pct;
                    const projected    = r.projected_gp;
                    const gpColor      = gp === null ? "text-muted-foreground" : projected !== null && gp < projected - 5 ? "text-red-600 font-semibold" : projected !== null && gp < projected - 0.1 ? "text-amber-600 font-semibold" : "text-green-600 font-semibold";
                    return (
                      <tr
                        key={r.id}
                        onClick={() => clientId && navigate(`/clients/${clientId}`)}
                        className={`border-b last:border-0 cursor-pointer hover:bg-accent/40 transition-colors ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium truncate">{clientName}</td>
                        <td className="px-4 py-3 text-muted-foreground truncate">{uploaderName}</td>
                        <td className="px-4 py-3 truncate">{r.name || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={gpColor}>{gp === null ? "—" : `${gp.toFixed(1)}%`}</span>
                          {projected !== null && (
                            <span className="text-muted-foreground text-xs ml-1">/ {projected.toFixed(1)}%</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(r.amount)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Fixed tfoot */}
          {sorted.length > 0 && (
            <table className="w-full text-sm table-fixed shrink-0 border-t">
              {COLS}
              <tfoot className="bg-[#f1f3f5]">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold">Total ({filtered.length} receipts)</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 text-sm shrink-0">
            <p className="text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary"}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
