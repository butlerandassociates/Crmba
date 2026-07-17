-- ============================================================
-- Migration 111: Sales Onboarding Portal — Full Schema
-- Butler & Associates CRM — Jul 16 2026
--
-- Content tables (admin-managed):
--   1. onboarding_programs       — program records (Sales, Foreman, etc.)
--   2. onboarding_modules        — training modules per program
--   3. onboarding_sections       — sections within each module (rich content)
--   4. onboarding_documents      — internal documents per program
--   5. onboarding_quiz_questions — quiz questions per program
--
-- Tracking tables (employee progress — wired in M2/M3/M4):
--   6. onboarding_module_progress
--   7. onboarding_document_acknowledgments
--   8. onboarding_quiz_attempts
--
-- All content tables: UUID PK, full audit columns, is_active, IF NOT EXISTS
-- Seed: Sales Onboarding program + 6 modules + 24 section headings +
--       7 documents + 15 quiz questions (all from confirmed Jonathan scope)
-- ============================================================


-- ─── 1. PROGRAMS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_programs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.onboarding_programs           IS 'Top-level onboarding programs (Sales, Foreman, etc.) — one program per role type';
COMMENT ON COLUMN public.onboarding_programs.is_active IS 'False = program hidden from employees without deleting content';


-- ─── 2. MODULES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_modules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       uuid        NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  tagline          text,
  category         text        NOT NULL DEFAULT 'Company',
  duration_minutes integer     NOT NULL DEFAULT 15,
  sort_order       integer     NOT NULL DEFAULT 0,
  is_published     boolean     NOT NULL DEFAULT false,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.onboarding_modules              IS 'Training modules within a program — displayed sequentially with unlock gates';
COMMENT ON COLUMN public.onboarding_modules.is_published IS 'False = draft, not visible to employees yet';
COMMENT ON COLUMN public.onboarding_modules.is_active    IS 'False = soft-deleted module, excluded from employee view and admin lists';
COMMENT ON COLUMN public.onboarding_modules.sort_order   IS 'Display order — sequential lock enforced by employee view';


-- ─── 3. SECTIONS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_sections (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid        NOT NULL REFERENCES public.onboarding_modules(id) ON DELETE CASCADE,
  heading    text        NOT NULL,
  content    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer     NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.onboarding_sections         IS 'Sections within a module — each has a heading and structured content blocks';
COMMENT ON COLUMN public.onboarding_sections.content IS 'JSONB array of content blocks: [{type:body|bullets|callout|table, ...}]';
COMMENT ON COLUMN public.onboarding_sections.is_active IS 'False = section hidden without delete';


-- ─── 4. DOCUMENTS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     uuid        NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  category       text        NOT NULL DEFAULT 'HR',
  is_required    boolean     NOT NULL DEFAULT false,
  file_size      text,
  effective_date date,
  description    text,
  content        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  sort_order     integer     NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.onboarding_documents              IS 'Internal documents employees must review and acknowledge';
COMMENT ON COLUMN public.onboarding_documents.is_required  IS 'True = employee must acknowledge before onboarding is considered complete';
COMMENT ON COLUMN public.onboarding_documents.file_size    IS 'Display-only string, e.g. "2.4 MB" — no actual file stored here';
COMMENT ON COLUMN public.onboarding_documents.content      IS 'JSONB array of content blocks rendered inline for the employee to read';
COMMENT ON COLUMN public.onboarding_documents.is_active    IS 'False = document removed from employee view without delete';


-- ─── 5. QUIZ QUESTIONS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_quiz_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid        NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  category      text        NOT NULL DEFAULT 'Company',
  question      text        NOT NULL,
  options       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer     NOT NULL DEFAULT 0,
  explanation   text,
  sort_order    integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.onboarding_quiz_questions               IS 'Quiz questions per program — multiple choice with one correct answer';
COMMENT ON COLUMN public.onboarding_quiz_questions.options        IS 'JSONB string array of answer options, e.g. ["A text", "B text", ...]';
COMMENT ON COLUMN public.onboarding_quiz_questions.correct_index  IS 'Zero-based index into the options array indicating the correct answer';
COMMENT ON COLUMN public.onboarding_quiz_questions.is_active      IS 'False = question excluded from quizzes without delete';


-- ─── 6. MODULE PROGRESS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_module_progress (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id       uuid        NOT NULL REFERENCES public.onboarding_modules(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'not_started'
                              CHECK (status IN ('not_started', 'in_progress', 'completed')),
  current_section integer     NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

COMMENT ON TABLE  public.onboarding_module_progress                IS 'Per-user per-module progress — upserted as employee advances through sections';
COMMENT ON COLUMN public.onboarding_module_progress.current_section IS 'Zero-based index of the section the employee last reached';


-- ─── 7. DOCUMENT ACKNOWLEDGMENTS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_document_acknowledgments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id     uuid        NOT NULL REFERENCES public.onboarding_documents(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id)
);

COMMENT ON TABLE public.onboarding_document_acknowledgments IS 'Records when an employee clicked Acknowledge on a document — immutable once set';


-- ─── 8. QUIZ ATTEMPTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_quiz_attempts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id     uuid        NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  category       text,
  question_count integer     NOT NULL DEFAULT 0,
  score          integer     NOT NULL DEFAULT 0,
  pct            numeric(5,2) NOT NULL DEFAULT 0,
  answers        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  attempt_number integer     NOT NULL DEFAULT 1,
  completed_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.onboarding_quiz_attempts              IS 'Each quiz run — 3-attempt limit enforced by application layer';
COMMENT ON COLUMN public.onboarding_quiz_attempts.pct          IS 'score / question_count × 100 — computed server-side';
COMMENT ON COLUMN public.onboarding_quiz_attempts.attempt_number IS '1-based count of how many times this employee has attempted the quiz';
COMMENT ON COLUMN public.onboarding_quiz_attempts.answers      IS 'JSONB array [{question_id, selected_index, correct_index, is_correct}]';


-- ─── 9. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ob_modules_program      ON public.onboarding_modules(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ob_sections_module      ON public.onboarding_sections(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ob_documents_program    ON public.onboarding_documents(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ob_quiz_program         ON public.onboarding_quiz_questions(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ob_mod_progress_user    ON public.onboarding_module_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ob_mod_progress_module  ON public.onboarding_module_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_ob_doc_acks_user        ON public.onboarding_document_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_ob_quiz_attempts_user   ON public.onboarding_quiz_attempts(user_id, program_id);


-- ─── 10. UPDATED_AT TRIGGERS ─────────────────────────────────────────────────
-- Reuses public.set_updated_at() — created in migration 085 (mileage tracker)

DO $$ BEGIN
  CREATE TRIGGER trg_ob_programs_updated_at
    BEFORE UPDATE ON public.onboarding_programs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ob_modules_updated_at
    BEFORE UPDATE ON public.onboarding_modules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ob_documents_updated_at
    BEFORE UPDATE ON public.onboarding_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ob_quiz_questions_updated_at
    BEFORE UPDATE ON public.onboarding_quiz_questions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ob_mod_progress_updated_at
    BEFORE UPDATE ON public.onboarding_module_progress
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── 11. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.onboarding_programs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_modules                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sections                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_quiz_questions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_module_progress           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_document_acknowledgments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_quiz_attempts             ENABLE ROW LEVEL SECURITY;

-- Content tables: all authenticated users can read active records;
-- only admin/manager can INSERT/UPDATE/DELETE
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'onboarding_programs', 'onboarding_modules', 'onboarding_sections',
    'onboarding_documents', 'onboarding_quiz_questions'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      'ob_read_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING   (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'',''manager'')))
       WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'',''manager'')))',
      'ob_admin_write_' || tbl, tbl
    );
  END LOOP;
END $$;

-- Tracking tables: users own their own rows; admin/manager can read all
CREATE POLICY "ob_read_mod_progress" ON public.onboarding_module_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE POLICY "ob_write_mod_progress" ON public.onboarding_module_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ob_read_doc_acks" ON public.onboarding_document_acknowledgments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE POLICY "ob_write_doc_acks" ON public.onboarding_document_acknowledgments
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ob_read_quiz_attempts" ON public.onboarding_quiz_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE POLICY "ob_insert_quiz_attempts" ON public.onboarding_quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ─── 12. SEED DATA ────────────────────────────────────────────────────────────
-- Full seed: 1 program, 6 modules, 24 section headings, 7 documents, 15 quiz questions
-- Uses DO block so UUID foreign keys chain correctly

DO $$
DECLARE
  prog_id uuid;
  m1 uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid; m6 uuid;
BEGIN

  -- Program
  INSERT INTO public.onboarding_programs (name, description)
  VALUES ('Sales Onboarding', 'Complete onboarding training for new sales team members')
  RETURNING id INTO prog_id;

  -- Modules
  INSERT INTO public.onboarding_modules (program_id, title, tagline, category, duration_minutes, sort_order, is_published)
  VALUES (prog_id, 'Welcome to Butler & Associates', 'Our history, culture, values, and the people you will work with every day.', 'Company', 15, 1, true)
  RETURNING id INTO m1;

  INSERT INTO public.onboarding_modules (program_id, title, tagline, category, duration_minutes, sort_order, is_published)
  VALUES (prog_id, 'Our Sales Process', 'The 6-stage pipeline: from first call to final payment.', 'Sales', 25, 2, true)
  RETURNING id INTO m2;

  INSERT INTO public.onboarding_modules (program_id, title, tagline, category, duration_minutes, sort_order, is_published)
  VALUES (prog_id, 'Construction Estimating Basics', 'Labor rates, material costs, markup strategy, and margin targets.', 'Estimating', 40, 3, true)
  RETURNING id INTO m3;

  INSERT INTO public.onboarding_modules (program_id, title, tagline, category, duration_minutes, sort_order, is_published)
  VALUES (prog_id, 'Building a Winning Proposal', 'How to structure proposals that convert at every pipeline stage.', 'Sales', 30, 4, true)
  RETURNING id INTO m4;

  INSERT INTO public.onboarding_modules (program_id, title, tagline, category, duration_minutes, sort_order, is_published)
  VALUES (prog_id, 'Client Communication Standards', 'Response SLAs, email tone, follow-up cadence, and documentation.', 'Communication', 20, 5, true)
  RETURNING id INTO m5;

  INSERT INTO public.onboarding_modules (program_id, title, tagline, category, duration_minutes, sort_order, is_published)
  VALUES (prog_id, 'CRM Mastery', 'Day-to-day workflow: updating stages, logging activity, and forecasting.', 'Tools', 35, 6, true)
  RETURNING id INTO m6;

  -- Sections (headings seeded — body content added via admin builder)
  INSERT INTO public.onboarding_sections (module_id, heading, sort_order) VALUES
    (m1, 'Who We Are', 1),
    (m1, 'Our Core Values', 2),
    (m1, 'The Team You Are Joining', 3),
    (m1, 'What Success Looks Like Here', 4);

  INSERT INTO public.onboarding_sections (module_id, heading, sort_order) VALUES
    (m2, 'Why a Defined Pipeline Matters', 1),
    (m2, 'Stage 1 — Prospect', 2),
    (m2, 'Stage 2 — Scheduled', 3),
    (m2, 'Stage 3 — Selling', 4),
    (m2, 'Stages 4–6 — Sold, Active, Completed', 5);

  INSERT INTO public.onboarding_sections (module_id, heading, sort_order) VALUES
    (m3, 'Why Sales Reps Must Understand Estimating', 1),
    (m3, 'How We Price Labor', 2),
    (m3, 'Material Pricing & Allowances', 3),
    (m3, 'Markup, Margin & O&P', 4);

  INSERT INTO public.onboarding_sections (module_id, heading, sort_order) VALUES
    (m4, 'Anatomy of a Proposal', 1),
    (m4, 'Writing a Compelling Scope of Work', 2),
    (m4, 'Presenting the Numbers', 3),
    (m4, 'Following Up After Proposal Delivery', 4);

  INSERT INTO public.onboarding_sections (module_id, heading, sort_order) VALUES
    (m5, 'Why Standards Exist', 1),
    (m5, 'Response Time SLAs', 2),
    (m5, 'Email & Messaging Tone', 3),
    (m5, 'Logging & Documentation', 4);

  INSERT INTO public.onboarding_sections (module_id, heading, sort_order) VALUES
    (m6, 'CRM as Source of Truth', 1),
    (m6, 'Updating Pipeline Stages', 2),
    (m6, 'Logging Activities', 3),
    (m6, 'Using Dashboard & Stats', 4);

  -- Documents
  INSERT INTO public.onboarding_documents (program_id, title, category, is_required, file_size, effective_date, description, sort_order) VALUES
    (prog_id, 'Employee Handbook 2026',               'HR',           true,  '2.4 MB', '2026-01-01', 'Company policies, expectations, benefits overview, and code of conduct.',                      1),
    (prog_id, 'Sales Commission Structure',           'Compensation', true,  '486 KB', '2026-01-01', 'How commissions are calculated, when they pay, and performance tiers.',                        2),
    (prog_id, 'Estimating Rate Sheet — 2026',         'Estimating',   true,  '1.1 MB', '2026-01-01', 'Current fully-loaded labor rates, standard material markups, and service categories.',         3),
    (prog_id, 'Proposal Template & Brand Guidelines', 'Sales',        true,  '3.8 MB', '2026-01-01', 'How to format, brand, and present proposals consistently.',                                    4),
    (prog_id, 'Non-Disclosure Agreement',             'Legal',        true,  '210 KB', '2026-01-01', 'Confidentiality obligations for client data, pricing, and company proprietary information.',   5),
    (prog_id, 'Safety & Jobsite Protocols',           'Operations',   false, '1.7 MB', '2026-01-01', 'Client site visit safety expectations and incident reporting procedures.',                     6),
    (prog_id, 'Vendor & Subcontractor Directory',     'Operations',   false, '920 KB', '2026-01-01', 'Approved vendors, subcontractors, and preferred supplier contacts.',                           7);

  -- Quiz questions (all 15 — correct answers and explanations from Jonathan scope)
  INSERT INTO public.onboarding_quiz_questions (program_id, category, question, options, correct_index, explanation, sort_order) VALUES

    (prog_id, 'Company',
     'What percentage of Butler & Associates new business comes from past client referrals?',
     '["Around 20%","Over 60%","About 40%","Less than 10%"]'::jsonb, 1,
     'Butler & Associates generates over 60% of new business from referrals and past clients. Every client interaction matters — your reputation drives future sales.', 1),

    (prog_id, 'Sales Process',
     'What is the maximum number of days a Prospect should go without outreach before it becomes a problem?',
     '["7 business days","5 business days","3 business days","10 business days"]'::jsonb, 2,
     'A Prospect that goes more than 3 business days without outreach risks going cold. Contact every Prospect at least every 3 days until they schedule or discard.', 2),

    (prog_id, 'Sales Process',
     'A deal moves from ''Selling'' to ''Sold'' when:',
     '["The client verbally agrees to move forward","You submit the proposal to the client","Contract signed by both parties","The client pays the deposit"]'::jsonb, 2,
     'Sold status requires a fully executed contract — signatures from both parties. A verbal agreement or deposit alone does not qualify.', 3),

    (prog_id, 'Sales Process',
     'Which stage indicates work is physically underway on the jobsite?',
     '["Sold","Active","Scheduled","Completed"]'::jsonb, 1,
     'Active means work has physically started. Sold = contract signed and deposit received. Active = mobilization has occurred and the crew is on site.', 4),

    (prog_id, 'Estimating',
     'A carpenter earns a $28/hr base wage. What is the approximate fully-loaded rate the company uses in estimates?',
     '["$28/hr — the base wage is used directly","$32–$36/hr","$40–$45/hr","$55–$65/hr"]'::jsonb, 2,
     'Fully-loaded rates include base wage plus payroll taxes, workers'' compensation, and benefits burden — typically 1.4–1.6× base. At $28/hr the loaded rate is approximately $40–$45/hr.', 5),

    (prog_id, 'Estimating',
     'Our target gross margin for residential projects is:',
     '["10–15%","20–30%","35–45%","50%+"]'::jsonb, 1,
     'Butler & Associates targets 20–30% gross margin on residential projects. Below 20% leaves too little for overhead and profit.', 6),

    (prog_id, 'Estimating',
     'A 25% markup on $10,000 in direct costs produces what gross margin?',
     '["25%","20%","30%","15%"]'::jsonb, 1,
     'A 25% markup on $10,000 adds $2,500 for a total of $12,500. Gross margin = $2,500 / $12,500 = 20%, not 25%. Markup and margin are different calculations.', 7),

    (prog_id, 'Proposals',
     'How long are Butler & Associates proposals typically valid?',
     '["7 days","60 days","30 days","90 days"]'::jsonb, 2,
     'Proposals are valid for 30 days from the date issued. After 30 days, material costs and labor rates may have changed. Always note the expiration date.', 8),

    (prog_id, 'Proposals',
     'A client says the proposal price is too high. Your first response should be:',
     '["Offer an immediate discount to keep the deal alive","Ask what specifically feels out of range","Explain that our prices are non-negotiable","Send a revised proposal with 10% off"]'::jsonb, 1,
     'Always ask first before adjusting anything. Clients often flag price when uncertain about scope or value — not always asking for a discount.', 9),

    (prog_id, 'Proposals',
     'When should you follow up after delivering a proposal?',
     '["Same day","After 2 weeks","Within 3–5 business days","Only if the client reaches out first"]'::jsonb, 2,
     'Follow up within 3–5 business days of delivery. Waiting longer signals low urgency and lets competitors get ahead.', 10),

    (prog_id, 'Communication',
     'What is our SLA for returning a client phone call during business hours?',
     '["Within 30 minutes","Within 2 hours","Within 4 hours","Same business day"]'::jsonb, 1,
     'Client calls must be returned within 2 hours during business hours (7AM–5PM Mon–Fri). Fast response differentiates Butler & Associates from larger contractors.', 11),

    (prog_id, 'Communication',
     'How would you describe the ideal Butler & Associates communication tone?',
     '["Formal and corporate — clients expect professionalism","Casual and friendly — we want clients to feel like friends","Knowledgeable-neighbor — warm, professional, direct","Brief and efficient — clients are busy people"]'::jsonb, 2,
     'The "knowledgeable-neighbor" tone means you sound like a trusted expert who genuinely cares — warm but professional, clear but not cold.', 12),

    (prog_id, 'CRM',
     'How long after a client interaction should you log it in the CRM?',
     '["Within 24 hours","Within 1 hour","Within 15 minutes","By end of business day"]'::jsonb, 2,
     'Log every client interaction within 15 minutes. Waiting longer means details get lost. If it is not logged, it did not happen.', 13),

    (prog_id, 'CRM',
     'A deal has been in ''Selling'' for 35 days with no client response. What should you do?',
     '["Move it to Discarded automatically after 30 days","Leave it — the client will respond when ready","Flag with manager check-in note and re-engage","Move it back to Prospect stage"]'::jsonb, 2,
     'A deal in Selling for 30+ days needs active attention. Log a note, flag for manager review, and make one final targeted re-engagement attempt.', 14),

    (prog_id, 'Company',
     'What happens to commission if a client delays payment on a project milestone?',
     '["Commission is paid on schedule regardless of client payment","Held until payment is collected","Commission is forfeited if payment is more than 30 days late","Commission is reduced by 50% for late-paying clients"]'::jsonb, 1,
     'Commissions are paid on collected revenue. If the client delays a milestone payment, your commission on that milestone is held until the payment is collected.', 15);

END $$;
