-- ─────────────────────────────────────────────────────────────────────────────
-- Public proposal link (/p/:id, the "View proposal" page) follows the order the
-- proposal was arranged in inside the CRM.
--
-- Jonathan (Oct 6 2026): the "View proposal" page must match how he arranged the
-- sections and items. The CRM detail view, the PDF and the client portal already
-- read estimate_line_items.sort_order, but get_public_proposal() always sorted by
-- created_at, so e.g. "Retaining Walls" (first in the CRM) showed LAST on the link.
--
-- Scope: switching every proposal would change what clients see on ~95 of 162
-- existing proposals, including ones already accepted. So sort_order is used for
--   * proposals still in play: any status other than accepted / declined / voided / sold, and
--   * any proposal flagged wizard_inputs._manualItemOrder = true (migration 125),
-- and finished proposals keep their exact current (created_at) order.
-- Ties are broken by created_at, then id, so the order is always deterministic.
-- Same column whitelist as migrations 120/125 — nothing else changes.
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
  FROM public.estimates e
  WHERE e.id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid) TO anon, authenticated;
