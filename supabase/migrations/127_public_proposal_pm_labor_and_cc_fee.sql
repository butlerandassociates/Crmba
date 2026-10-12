-- ─────────────────────────────────────────────────────────────────────────────
-- Public proposal link (/p/:id, "View Proposal") totals now match the PDF.
--
-- Jonathan (Oct 12 2026): for one proposal the "View Proposal" page and the email showed
-- $110,685.99 while the PDF showed $113,879.74. The PDF bills the marked-up PM Labor Hours
-- inside the client-facing "Base, Aggregate & Disposal" line (Sep 22 2026) and adds the CC
-- processing fee; the public page only had estimates.bad_amount (BAD alone) so it left both out.
--
-- get_public_proposal() now also returns:
--   pm_labor_amount   — Σ(hours × hourly_rate) of estimate_pm_labor_items, marked up at the
--                       job's markup. Same rule as proposal-detail.tsx / email-templates-dialog.tsx:
--                       wizard_inputs._markupPct when set, otherwise derived from the line items
--                       ((subtotal − direct cost) / direct cost), rounded to cents.
--   stripe_fee_amount — 2.9% + $0.30 of everything before the fee, only when stripe_fee_enabled.
-- Computed live from the PM-hours table (rows are written the moment they are added), so the
-- page is right even before the proposal is re-saved. Everything else is unchanged from 126
-- (same column whitelist, same ordering rules).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_proposal(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', e.id,
    'client_id', e.client_id,
    'title', e.title,
    'description', e.description,
    'status', e.status,
    'subtotal', e.subtotal,
    'discount_amount', e.discount_amount,
    'bad_amount', e.bad_amount,
    'pm_labor_amount', e.pm_amt,
    'stripe_fee_amount',
      CASE WHEN COALESCE(e.stripe_fee_enabled, false)
        THEN round(((COALESCE(e.subtotal, 0) + COALESCE(e.bad_amount, 0) + e.pm_amt
                     + COALESCE(e.tax_amount, 0) - COALESCE(e.discount_amount, 0)) * 0.029 + 0.30)::numeric, 2)
        ELSE 0
      END,
    'tax_amount', e.tax_amount,
    'category_notes', e.category_notes,
    'client', (
      SELECT jsonb_build_object(
        'id', c.id,
        'first_name', c.first_name,
        'last_name', c.last_name,
        'address', c.address,
        'city', c.city,
        'state', c.state,
        'phone', c.phone,
        'email', c.email
      )
      FROM public.clients c WHERE c.id = e.client_id
    ),
    'line_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', li.id,
        'category', li.category,
        'product_name', li.product_name,
        'name', li.name,
        'description', li.description,
        'client_note', li.client_note,
        'quantity', li.quantity,
        'client_price', li.client_price,
        'price_per_unit', li.price_per_unit,
        'total_price', li.total_price
      ) ORDER BY
        CASE
          WHEN e.status NOT IN ('accepted', 'declined', 'voided', 'sold')
            OR (e.wizard_inputs ->> '_manualItemOrder') = 'true'
          THEN li.sort_order
        END,
        li.created_at,
        li.id)
      FROM public.estimate_line_items li
      WHERE li.estimate_id = e.id
    ), '[]'::jsonb)
  )
  FROM (
    SELECT est.*,
      round((
        COALESCE((SELECT SUM(pm.hours * pm.hourly_rate)
                  FROM public.estimate_pm_labor_items pm WHERE pm.estimate_id = est.id), 0)
        * (1 + COALESCE(
              NULLIF(est.wizard_inputs ->> '_markupPct', '')::numeric,
              CASE WHEN dc.direct_cost > 0
                   THEN (COALESCE(est.subtotal, 0) - dc.direct_cost) / dc.direct_cost * 100
                   ELSE 0 END
            ) / 100)
      )::numeric, 2) AS pm_amt
    FROM public.estimates est
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(li2.quantity * (COALESCE(li2.material_cost, 0) + COALESCE(li2.labor_cost, 0))), 0) AS direct_cost
      FROM public.estimate_line_items li2 WHERE li2.estimate_id = est.id
    ) dc
    WHERE est.id = p_id
  ) e;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid) TO anon, authenticated;
