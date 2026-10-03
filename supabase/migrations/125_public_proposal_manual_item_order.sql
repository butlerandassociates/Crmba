-- ─────────────────────────────────────────────────────────────────────────────
-- Public proposal link (/p/:id) honors a deliberately set item order.
--
-- Jonathan (Oct 3 2026) asked to drag items into a chosen order within a section.
-- The order is saved in estimate_line_items.sort_order (the CRM view, the PDF and the
-- client portal already read it), but get_public_proposal() has always sorted by
-- created_at, so the /p/ link ignored it.
--
-- Sorting every proposal by sort_order would change how ~90 existing proposals
-- look to clients, so this only applies to proposals flagged
-- wizard_inputs._manualItemOrder = true (set by the app the first time someone drags
-- an item). Every other proposal keeps its exact current created_at ordering.
-- Same column whitelist as migration 120 — nothing else changes.
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
        CASE WHEN (e.wizard_inputs ->> '_manualItemOrder') = 'true' THEN li.sort_order END,
        li.created_at)
      FROM public.estimate_line_items li
      WHERE li.estimate_id = e.id
    ), '[]'::jsonb)
  )
  FROM public.estimates e
  WHERE e.id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid) TO anon, authenticated;
