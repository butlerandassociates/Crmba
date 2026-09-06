-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: get_public_proposal() leaked whole-row data to anonymous visitors.
--
-- The function added in 102_public_proposal_access.sql used to_jsonb(e) /
-- to_jsonb(li) / to_jsonb(c) to build the public proposal payload. That means
-- EVERY column on estimates, estimate_line_items, and clients — including
-- internal-only fields explicitly documented as "never shown on PDF"
-- (material_cost, labor_cost, markup_percentage, gross_profit, profit_margin,
-- total_cost) — was already present in the raw network response an anonymous
-- visitor's browser receives at /p/:id, even though the React page never
-- rendered them. This rewrite switches to an explicit column whitelist so
-- only fields the public page actually uses are ever returned, and so future
-- internal-only columns (pricing_mode, overhead_burden, burdened_cost, net_gp,
-- net_margin_pct, net_after_commission, bad_rate, contingency_reserve,
-- contingency_consumed, contingency_released, commission_excluded) are safe
-- by default without needing to remember to exclude them one by one.
--
-- Whitelist was derived by reading exactly which fields
-- src/app/components/public-proposal.tsx consumes from `proposal`,
-- `proposal.line_items[]`, and `proposal.client` — not guessed.
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
      ) ORDER BY li.created_at)
      FROM public.estimate_line_items li
      WHERE li.estimate_id = e.id
    ), '[]'::jsonb)
  )
  FROM public.estimates e
  WHERE e.id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid) TO anon, authenticated;
