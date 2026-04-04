/**
 * Change Orders API
 * Project scope changes sent to clients for approval.
 */

import { supabase } from "@/lib/supabase";

export const changeOrdersAPI = {
  /** All COs for a client */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("change_orders")
      .select(`*, items:change_order_items(*)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Create a CO with items */
  create: async (
    co: { client_id: string; project_id?: string; title: string; reason?: string; timeline_impact?: string; status?: string },
    items: { category: string; description: string; quantity: number; unit_price: number; total: number }[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const costImpact = items.reduce((s, i) => s + i.total, 0);

    const { data: created, error } = await supabase
      .from("change_orders")
      .insert({ ...co, cost_impact: costImpact, submitted_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("change_order_items")
        .insert(items.map((item, i) => ({ ...item, co_id: created.id, sort_order: i })));
      if (itemsError) throw new Error(itemsError.message);
    }
    return created;
  },

  /** Update CO status */
  updateStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from("change_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Merge an approved CO into the client's accepted proposal.
   * - Appends CO line items to estimate_line_items
   * - Fully recalculates: subtotal → discount → tax → total → gross_profit → profit_margin
   * - Updates project: total_value, gross_profit, profit_margin, commission
   * - Sets CO status → "merged"
   */
  mergeApproved: async (co: any, clientId: string) => {
    // 1. Find the accepted estimate with all financial fields
    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select("id, subtotal, discount_percentage, discount_amount, tax_rate, tax_amount, total, total_cost, gross_profit, profit_margin")
      .eq("client_id", clientId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (estError) throw new Error(estError.message);
    if (!estimate) throw new Error("No accepted proposal found for this client.");

    // 2. Get current max sort_order in estimate_line_items
    const { data: maxSortRow } = await supabase
      .from("estimate_line_items")
      .select("sort_order")
      .eq("estimate_id", estimate.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startSort = (maxSortRow?.sort_order ?? 0) + 1;

    // 3. Insert CO items into estimate_line_items
    const coItems: any[] = co.items || [];
    if (coItems.length > 0) {
      const { error: liError } = await supabase
        .from("estimate_line_items")
        .insert(
          coItems.map((item: any, i: number) => ({
            estimate_id: estimate.id,
            product_name: item.description,
            description: `Change Order: ${co.title}`,
            category: item.category,
            quantity: item.quantity,
            client_price: item.unit_price,
            total_price: item.total,
            sort_order: startSort + i,
          }))
        );
      if (liError) throw new Error(liError.message);
    }

    // 4. Recalculate all estimate financials
    const costImpact = co.cost_impact || 0;
    const newSubtotal = (estimate.subtotal || 0) + costImpact;

    // Recalculate discount amount if a % discount is applied
    const discountPct = estimate.discount_percentage || 0;
    const newDiscountAmount = discountPct > 0
      ? newSubtotal * (discountPct / 100)
      : (estimate.discount_amount || 0);

    const subtotalAfterDiscount = newSubtotal - newDiscountAmount;

    // Recalculate tax
    const taxRate = estimate.tax_rate || 0;
    const newTaxAmount = subtotalAfterDiscount * (taxRate / 100);

    const newTotal = subtotalAfterDiscount + newTaxAmount;

    // Recalculate gross profit & margin (cost side stays the same)
    const totalCost = estimate.total_cost || 0;
    const newGrossProfit = newTotal - totalCost;
    const newProfitMargin = newTotal > 0 ? (newGrossProfit / newTotal) * 100 : 0;

    const { error: estUpdateError } = await supabase
      .from("estimates")
      .update({
        subtotal: newSubtotal,
        discount_amount: newDiscountAmount,
        tax_amount: newTaxAmount,
        total: newTotal,
        gross_profit: newGrossProfit,
        profit_margin: newProfitMargin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);
    if (estUpdateError) throw new Error(estUpdateError.message);

    // 5. Update project: total_value, gross_profit, profit_margin, commission
    if (co.project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("total_value, gross_profit, profit_margin, commission")
        .eq("id", co.project_id)
        .maybeSingle();
      if (proj) {
        const projNewTotal = (proj.total_value || 0) + costImpact;
        const projNewGrossProfit = (proj.gross_profit || 0) + costImpact; // revenue side increases
        const projNewMargin = projNewTotal > 0 ? (projNewGrossProfit / projNewTotal) * 100 : 0;
        // Recalculate commission proportionally if it was set
        const commissionRate = proj.total_value > 0 && proj.commission
          ? (proj.commission / proj.total_value)
          : 0;
        const projNewCommission = commissionRate > 0 ? projNewTotal * commissionRate : (proj.commission || 0);

        await supabase
          .from("projects")
          .update({
            total_value: projNewTotal,
            gross_profit: projNewGrossProfit,
            profit_margin: projNewMargin,
            commission: projNewCommission,
            updated_at: new Date().toISOString(),
          })
          .eq("id", co.project_id);
      }
    }

    // 6. Mark CO as merged
    const { data: updatedCo, error: coUpdateError } = await supabase
      .from("change_orders")
      .update({ status: "merged", updated_at: new Date().toISOString() })
      .eq("id", co.id)
      .select()
      .single();
    if (coUpdateError) throw new Error(coUpdateError.message);

    return { updatedCo, newEstimateTotal: newTotal };
  },

  /** Delete a CO */
  delete: async (id: string) => {
    const { error } = await supabase.from("change_orders").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
