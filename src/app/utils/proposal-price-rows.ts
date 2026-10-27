// The price breakdown a client sees under a proposal's line items (client portal).
// Jonathan, Oct 28 2026: the portal showed Subtotal $111,457.24 + Sales Tax $1,424.18 = TOTAL $116,841.60, i.e. the
// "Base, Aggregate & Disposal" line (BAD + the marked-up PM Labor Hours, as on the PDF and the public page), any
// discount and the CC processing fee were missing, so the numbers did not add up. This builds the full list and
// guarantees the rows always sum to the total, even if a part is missing or the saved parts do not agree.

export type ProposalPriceInput = {
  subtotal?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  total?: number | null;
  discount_amount?: number | null;
  bad_amount?: number | null;
  pm_labor_amount?: number | null;
  stripe_fee_amount?: number | null;
};

export type PriceRow = { key: "subtotal" | "discount" | "bad" | "tax" | "fee"; label: string; amount: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function proposalPriceRows(p: ProposalPriceInput): { rows: PriceRow[]; total: number } {
  const subtotal = Number(p.subtotal ?? 0);
  const tax = Number(p.tax_amount ?? 0);
  const total = Number(p.total ?? 0);
  const discount = Number(p.discount_amount ?? 0);
  const fee = Number(p.stripe_fee_amount ?? 0);
  const hasParts = p.bad_amount !== undefined && p.bad_amount !== null;
  // BAD line = BAD + marked-up PM labor; when the parts are unknown it is whatever closes the gap to the total
  let bad = hasParts ? Number(p.bad_amount ?? 0) + Number(p.pm_labor_amount ?? 0) : total - subtotal + discount - tax - fee;
  // never let the rows disagree with the total the client is asked to pay
  const gap = r2(total - (subtotal - discount + bad + tax + fee));
  if (Math.abs(gap) > 0.02) bad = bad + gap;
  bad = r2(bad);

  const rows: PriceRow[] = [{ key: "subtotal", label: "Subtotal", amount: r2(subtotal) }];
  if (discount > 0) rows.push({ key: "discount", label: "Discount", amount: -r2(discount) });
  if (Math.abs(bad) >= 0.005) rows.push({ key: "bad", label: "Base, Aggregate & Disposal", amount: bad });
  if (tax > 0) rows.push({ key: "tax", label: Number(p.tax_rate ?? 0) > 0 ? `Sales Tax (${p.tax_rate}%)` : "Sales Tax", amount: r2(tax) });
  if (fee > 0) rows.push({ key: "fee", label: "CC Processing Fee", amount: r2(fee) });
  return { rows, total: r2(total) };
}
