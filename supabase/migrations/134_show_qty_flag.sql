-- "Show QTY" toggle (Jonathan, Oct 25-26 2026):
--   "on the client side, please don't show them QTY ... give me the ability to toggle QTY on/off in change
--    orders and the proposal builder ... this will let me show the QTY specifically for that category.
--    For instance, with the concrete wizard at 400 sqft, the QTY will only show 400 sqft, but not the QTY
--    for #57 stone, rebar, etc."
--
-- One flag per line. Default false = the client sees name + amount only (what proposals already did).
-- Turn it on for a line and the client-facing views add its quantity + unit next to the name.
-- A change order's items carry the flag into the proposal when the CO is merged.
--
-- get_public_proposal() (the public "View Proposal" page) is re-created EXACTLY as in 127, with two more
-- keys per line item: 'unit' and 'show_qty' (needed to print "400 SF" when the flag is on).
-- Additive only, safe to re-run. Run this BEFORE deploying the code / edge function that uses show_qty.

ALTER TABLE public.estimate_line_items ADD COLUMN IF NOT EXISTS show_qty boolean NOT NULL DEFAULT false;
ALTER TABLE public.change_order_items  ADD COLUMN IF NOT EXISTS show_qty boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.estimate_line_items.show_qty IS 'true = show this line''s quantity + unit to the client (proposal page, PDF, portal). Default hides it.';
COMMENT ON COLUMN public.change_order_items.show_qty  IS 'true = show this item''s quantity + unit to the client (change order email, portal, PDF). Default hides it.';

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
        'unit', li.unit,
        'show_qty', COALESCE(li.show_qty, false),
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
