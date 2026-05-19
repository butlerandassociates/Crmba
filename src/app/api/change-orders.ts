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

  /** Create a CO with items and optional modifications */
  create: async (
    co: { client_id: string; project_id?: string; title: string; reason?: string; timeline_impact?: string; status?: string; original_total?: number; new_total?: number; cost_impact?: number },
    items: { category: string; description: string; quantity: number; unit_price: number; total: number }[],
    modifications?: any[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    // Use pre-computed cost_impact (includes modification deltas) if provided, else fall back to items sum
    const costImpact = co.cost_impact ?? items.reduce((s, i) => s + i.total, 0);

    const { cost_impact: _ci, ...coRest } = co;
    const { data: created, error } = await supabase
      .from("change_orders")
      .insert({ ...coRest, cost_impact: costImpact, submitted_by: user?.id, modifications: modifications ?? [] })
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
    const extra: Record<string, string | null> = {};
    if (status === "approved") {
      const { data: { user } } = await supabase.auth.getUser();
      extra.approved_by = user?.id ?? null;
      extra.approved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("change_orders")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Merge an approved CO into the client's accepted proposal.
   * - Applies modifications (edits/deletions) to existing line items
   * - Appends new CO line items to estimate_line_items
   * - Fully recalculates: subtotal → discount → tax → total → gross_profit → profit_margin
   * - Updates project: total_value, gross_profit, profit_margin, commission
   * - Sets CO status → "merged"
   */
  mergeApproved: async (co: any, clientId: string, modifications?: { action: 'edit' | 'delete'; estimate_item_id: string; quantity?: number; client_price?: number; total_price?: number }[]) => {
    // 1. Find the accepted estimate with all financial fields
    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select("id, subtotal, discount_percentage, discount_amount, tax_rate, tax_amount, total, total_cost, gross_profit, profit_margin, stripe_fee_enabled, bad_amount")
      .eq("client_id", clientId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (estError) throw new Error(estError.message);
    if (!estimate) throw new Error("No accepted proposal found for this client.");

    const preMergeTotal = Number(estimate.total || 0);

    // 2. Apply modifications to existing line items (edit/delete)
    const mods = modifications ?? (co.modifications ?? []);

    // Fetch original line items BEFORE modifications — needed for BAD delta calculation
    const { data: originalLineItems } = await supabase
      .from("estimate_line_items")
      .select("id, category, labor_cost, total_price")
      .eq("estimate_id", estimate.id);

    for (const mod of mods) {
      if (mod.action === "delete") {
        await supabase.from("estimate_line_items").delete().eq("id", mod.estimate_item_id);
      } else if (mod.action === "edit") {
        await supabase.from("estimate_line_items").update({
          quantity: mod.quantity,
          client_price: mod.client_price,
          total_price: mod.total_price,
        }).eq("id", mod.estimate_item_id);
      }
    }

    // 3. Get current max sort_order in estimate_line_items (after modifications)
    const { data: maxSortRow } = await supabase
      .from("estimate_line_items")
      .select("sort_order")
      .eq("estimate_id", estimate.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startSort = (maxSortRow?.sort_order ?? 0) + 1;

    // 4. Insert new CO items into estimate_line_items
    const coItems: any[] = co.items || [];
    if (coItems.length > 0) {
      const { error: liError } = await supabase
        .from("estimate_line_items")
        .insert(
          coItems.map((item: any, i: number) => ({
            estimate_id: estimate.id,
            name: item.description || co.title,
            product_name: item.description || co.title,
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

    // 5. Re-sum subtotal from all remaining line items (accurate after edits/deletes/additions)
    const { data: allLineItems } = await supabase
      .from("estimate_line_items")
      .select("total_price, category, labor_cost")
      .eq("estimate_id", estimate.id);
    const newSubtotal = (allLineItems ?? []).reduce((s: number, li: any) => s + Number(li.total_price || 0), 0);

    // BAD — stored-base + delta (full recalculation is wrong: labor_cost not stored on all qualifying items)
    const BAD_CATEGORIES = ["Concrete", "Pavers", "Retaining Walls", "Sod"];
    const originalBad = Number(estimate.bad_amount || 0);
    const modBadDelta = mods.reduce((s: number, mod: any) => {
      const li = (originalLineItems ?? []).find((l: any) => l.id === mod.estimate_item_id);
      if (!li) return s;
      const qualifies = BAD_CATEGORIES.includes(li.category) || Number(li.labor_cost || 0) > 0;
      if (!qualifies) return s;
      if (mod.action === "delete") return s + (-Number(li.total_price || 0) * 0.015 * 1.5);
      if (mod.action === "edit") return s + ((Number(mod.total_price || 0) - Number(li.total_price || 0)) * 0.015 * 1.5);
      return s;
    }, 0);
    const coBadQualifying = coItems
      .filter((i: any) => i.description?.trim() && BAD_CATEGORIES.includes(i.category))
      .reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const newBadAmount = Math.round((originalBad + modBadDelta + coBadQualifying * 0.015 * 1.5) * 100) / 100;

    // Recalculate discount amount if a % discount is applied
    const discountPct = estimate.discount_percentage || 0;
    const newDiscountAmount = discountPct > 0
      ? newSubtotal * (discountPct / 100)
      : (estimate.discount_amount || 0);

    const subtotalAfterDiscount = newSubtotal - newDiscountAmount;

    // Recalculate tax — preserve ratio from original (if tax was $0, keep $0)
    const origSubtotalAfterDiscount = (estimate.subtotal || 0) - (estimate.discount_amount || 0);
    const taxRatio = origSubtotalAfterDiscount > 0 ? (estimate.tax_amount || 0) / origSubtotalAfterDiscount : 0;
    const newTaxAmount = subtotalAfterDiscount * taxRatio;

    // Recalculate CC processing fee if enabled (2.9% + $0.30 flat)
    const preStripeTotal = subtotalAfterDiscount + newBadAmount + newTaxAmount;
    const newStripeFee = estimate.stripe_fee_enabled
      ? Math.round((preStripeTotal * 0.029 + 0.30) * 100) / 100
      : 0;

    const newTotal = preStripeTotal + newStripeFee;

    // Recalculate gross profit & margin (cost side stays the same)
    const totalCost = estimate.total_cost || 0;
    const newGrossProfit = newTotal - totalCost;
    const newProfitMargin = newTotal > 0 ? (newGrossProfit / newTotal) * 100 : 0;

    const { error: estUpdateError } = await supabase
      .from("estimates")
      .update({
        subtotal: newSubtotal,
        discount_amount: newDiscountAmount,
        bad_amount: newBadAmount,
        tax_amount: newTaxAmount,
        stripe_fee_amount: newStripeFee,
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
        .select("total_value, total_costs, gross_profit, profit_margin, commission")
        .eq("id", co.project_id)
        .maybeSingle();
      if (proj) {
        // Use the recalculated proposal total directly — this accounts for any discount % or tax rate
        // on the proposal so project.total_value always stays in sync with proposal.total
        const projNewTotal = newTotal;
        const projNewGrossProfit = projNewTotal - (proj.total_costs || 0);
        const projNewMargin = projNewTotal > 0 ? (projNewGrossProfit / projNewTotal) * 100 : 0;
        // Recalculate commission proportionally if it was set
        const commissionRate = (proj.total_value || 0) > 0 && proj.commission
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

    // 6. Mark CO as merged + save pre/post totals for before-vs-after display
    const { data: updatedCo, error: coUpdateError } = await supabase
      .from("change_orders")
      .update({
        status: "merged",
        pre_merge_total: preMergeTotal,
        post_merge_total: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", co.id)
      .select()
      .single();
    if (coUpdateError) throw new Error(coUpdateError.message);

    return { updatedCo, newEstimateTotal: newTotal };
  },

  /** Update a draft CO — replaces items and saves modifications */
  update: async (
    id: string,
    co: { title: string; reason?: string; timeline_impact?: string; approval_verified?: boolean; approval_file_url?: string },
    items: { category: string; description: string; quantity: number; unit_price: number; total: number }[],
    modifications?: any[]
  ) => {
    const costImpact = items.reduce((s, i) => s + i.total, 0);
    const { data, error } = await supabase
      .from("change_orders")
      .update({ ...co, cost_impact: costImpact, modifications: modifications ?? [], updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Replace all items
    await supabase.from("change_order_items").delete().eq("co_id", id);
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("change_order_items")
        .insert(items.map((item, i) => ({ ...item, co_id: id, sort_order: i })));
      if (itemsError) throw new Error(itemsError.message);
    }
    return data;
  },

  /** Delete a CO */
  delete: async (id: string) => {
    const { error } = await supabase.from("change_orders").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
