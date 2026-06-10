-- ─────────────────────────────────────────────────────────────────────────────
-- Public proposal access (fixes "Proposal Not Found" on the emailed
-- "View & Accept Proposal" link for logged-out clients).
--
-- The public page at /p/:id is accessed anonymously. Tables (estimates, clients,
-- estimate_line_items) intentionally have NO anon table access. These SECURITY
-- DEFINER functions are the auth layer: anon can only fetch / act on a single
-- proposal by its exact UUID — no table enumeration, no PII exposure beyond the
-- one proposal's own client.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Fetch a single proposal (+ its client + line items) by id
CREATE OR REPLACE FUNCTION public.get_public_proposal(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(e)
         || jsonb_build_object(
              'client',
              (SELECT to_jsonb(c) FROM public.clients c WHERE c.id = e.client_id),
              'line_items',
              COALESCE((SELECT jsonb_agg(to_jsonb(li) ORDER BY li.created_at)
                        FROM public.estimate_line_items li
                        WHERE li.estimate_id = e.id), '[]'::jsonb)
            )
  FROM public.estimates e
  WHERE e.id = p_id;
$$;

-- 2. Mark a sent proposal as opened (first view) + log it
CREATE OR REPLACE FUNCTION public.mark_public_proposal_opened(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  text;
  v_client uuid;
  v_name   text;
BEGIN
  SELECT title, client_id INTO v_title, v_client
  FROM public.estimates WHERE id = p_id AND status = 'sent';
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.estimates SET status = 'opened', opened_at = now() WHERE id = p_id;

  SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
  INTO v_name FROM public.clients WHERE id = v_client;

  INSERT INTO public.notifications (type, title, message, link, is_read, created_by)
  VALUES ('proposal_opened', 'Proposal Opened',
          coalesce(v_name,'Client') || ' opened the proposal "' || coalesce(v_title,'') || '"',
          '/proposals/' || p_id, false, null);

  IF v_client IS NOT NULL THEN
    INSERT INTO public.activity_log (client_id, action_type, description, created_at)
    VALUES (v_client, 'proposal_viewed', 'Client opened proposal: "' || coalesce(v_title,'') || '"', now());
  END IF;
END;
$$;

-- 3. Accept or decline a proposal (+ side effects) in one atomic call
CREATE OR REPLACE FUNCTION public.respond_to_public_proposal(
  p_id     uuid,
  p_action text,            -- 'accept' | 'decline'
  p_reason text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  text;
  v_client uuid;
  v_name   text;
  v_voided record;
BEGIN
  SELECT title, client_id INTO v_title, v_client FROM public.estimates WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
  INTO v_name FROM public.clients WHERE id = v_client;

  IF p_action = 'accept' THEN
    UPDATE public.estimates
      SET status = 'accepted', accepted_at = now()
      WHERE id = p_id;

    -- Auto-void this client's other open proposals
    IF v_client IS NOT NULL THEN
      FOR v_voided IN
        UPDATE public.estimates
          SET status = 'voided', voided_at = now()
          WHERE client_id = v_client AND id <> p_id
            AND status IN ('draft','sent','opened')
          RETURNING title
      LOOP
        INSERT INTO public.activity_log (client_id, action_type, description, created_at)
        VALUES (v_client, 'status_changed',
                'Proposal ' || coalesce(v_voided.title,'') || ' — voided by accepted proposal ' || coalesce(v_title,''),
                now());
      END LOOP;
    END IF;

    INSERT INTO public.notifications (type, title, message, link, is_read, created_by, metadata)
    VALUES ('proposal_accepted', 'Proposal Accepted',
            'Accepted the proposal "' || coalesce(v_title,'') || '".',
            '/proposals/' || p_id, false, null,
            jsonb_build_object('proposal_id', p_id, 'client_id', v_client, 'client_name', v_name));

    IF v_client IS NOT NULL THEN
      INSERT INTO public.activity_log (client_id, action_type, description, created_at)
      VALUES (v_client, 'proposal_accepted', 'Client accepted proposal: "' || coalesce(v_title,'') || '"', now());
    END IF;

  ELSIF p_action = 'decline' THEN
    UPDATE public.estimates
      SET status = 'declined', declined_at = now(),
          decline_reason = nullif(trim(coalesce(p_reason,'')), ''), declined_by = null
      WHERE id = p_id;

    INSERT INTO public.notifications (type, title, message, link, is_read, created_by, metadata)
    VALUES ('proposal_declined', 'Proposal Declined',
            'Declined the proposal "' || coalesce(v_title,'') || '"' ||
              CASE WHEN nullif(trim(coalesce(p_reason,'')),'') IS NOT NULL
                   THEN ' — "' || trim(p_reason) || '"' ELSE '' END || '.',
            '/proposals/' || p_id, false, null,
            jsonb_build_object('proposal_id', p_id, 'client_id', v_client, 'client_name', v_name));

    IF v_client IS NOT NULL THEN
      INSERT INTO public.activity_log (client_id, action_type, description, created_at)
      VALUES (v_client, 'proposal_rejected',
              'Client declined proposal: "' || coalesce(v_title,'') || '"' ||
                CASE WHEN nullif(trim(coalesce(p_reason,'')),'') IS NOT NULL
                     THEN ' — "' || trim(p_reason) || '"' ELSE '' END,
              now());
    END IF;
  END IF;
END;
$$;

-- Grant execute to anonymous (public) + authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_public_proposal_opened(uuid)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_public_proposal(uuid, text, text) TO anon, authenticated;
