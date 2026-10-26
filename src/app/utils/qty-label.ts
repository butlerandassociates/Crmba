// "Show QTY" toggle (Jonathan, Oct 25-26 2026). A line only shows its quantity to the client when its
// show_qty flag is on; otherwise the client sees name + amount only. Returns "" when hidden.
export function qtyLabel(item: { show_qty?: boolean | null; quantity?: number | string | null; unit?: string | null } | null | undefined): string {
  if (!item || !item.show_qty) return "";
  const q = Number(item.quantity);
  if (!isFinite(q) || q <= 0) return "";
  const qs = q.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const u = (item.unit ?? "").toString().trim();
  return u ? `${qs} ${u}` : qs;
}
