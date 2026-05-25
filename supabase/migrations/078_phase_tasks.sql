-- Phase task system: templates per job type + per-project task completions

-- Template definitions (one per job type)
CREATE TABLE phase_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phases within each template
CREATE TABLE phase_template_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES phase_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tasks within each template phase (photo/note requirement flags)
CREATE TABLE phase_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_phase_id uuid NOT NULL REFERENCES phase_template_phases(id) ON DELETE CASCADE,
  label text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  photo_required boolean NOT NULL DEFAULT false,
  note_required boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Per-project task completions — snapshot of template tasks at load time + completion state
CREATE TABLE phase_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  task_label text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  photo_required boolean NOT NULL DEFAULT false,
  note_required boolean NOT NULL DEFAULT false,
  is_completed boolean NOT NULL DEFAULT false,
  photo_url text,
  note text,
  completed_by uuid REFERENCES profiles(id),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Triggers
CREATE TRIGGER set_updated_at_phase_templates
  BEFORE UPDATE ON phase_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_phase_template_phases
  BEFORE UPDATE ON phase_template_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_phase_template_tasks
  BEFORE UPDATE ON phase_template_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_phase_task_completions
  BEFORE UPDATE ON phase_task_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE phase_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_template_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase_templates_all" ON phase_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "phase_template_phases_all" ON phase_template_phases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "phase_template_tasks_all" ON phase_template_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "phase_task_completions_all" ON phase_task_completions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPC: create project phases + task completions from a specific template
CREATE OR REPLACE FUNCTION init_phases_from_template(p_project_id uuid, p_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tp RECORD;
  v_task RECORD;
  v_phase_id uuid;
BEGIN
  -- Soft-delete existing phases; hard-delete their task completions
  UPDATE project_phases SET is_active = false, updated_at = now() WHERE project_id = p_project_id;
  DELETE FROM phase_task_completions WHERE project_id = p_project_id;

  FOR v_tp IN
    SELECT * FROM phase_template_phases WHERE template_id = p_template_id ORDER BY order_index
  LOOP
    INSERT INTO project_phases (project_id, label, order_index, status, progress_pct)
    VALUES (p_project_id, v_tp.label, v_tp.order_index, 'upcoming', 0)
    RETURNING id INTO v_phase_id;

    FOR v_task IN
      SELECT * FROM phase_template_tasks WHERE template_phase_id = v_tp.id ORDER BY order_index
    LOOP
      INSERT INTO phase_task_completions
        (project_id, phase_id, task_label, order_index, photo_required, note_required)
      VALUES
        (p_project_id, v_phase_id, v_task.label, v_task.order_index, v_task.photo_required, v_task.note_required);
    END LOOP;
  END LOOP;
END;
$$;

-- Storage bucket note: create bucket "phase-task-photos" in Supabase Dashboard → Storage
-- with public access ON so uploaded photo URLs work in the portal.

-- ─── Seed all 5 job type templates ───────────────────────────────────────────

DO $$
DECLARE
  v_tid uuid;
  v_pid uuid;
BEGIN

  -- ── PAVERS ──────────────────────────────────────────────────────────────────
  INSERT INTO phase_templates (job_type, name) VALUES ('pavers', 'Pavers') RETURNING id INTO v_tid;

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Demolition', 0) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Existing materials removed and hauled off', 0, true, false),
    (v_pid, 'Area cleared and debris-free', 1, false, false),
    (v_pid, 'Dump receipt captured or on file', 2, false, false),
    (v_pid, 'Site ready for prep phase', 3, false, true);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Preparation and Grading', 1) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Subgrade excavated to proper depth', 0, false, false),
    (v_pid, 'Grading verified for drainage slope', 1, true, false),
    (v_pid, 'Paver base material installed', 2, false, false),
    (v_pid, '3/4" crusher run installed on top of paver base', 3, false, false),
    (v_pid, 'Base and crusher run compacted and verified level', 4, true, false);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Paver Installation', 2) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Pavers laid in approved pattern/layout', 0, true, false),
    (v_pid, 'Cuts completed where necessary (edges, curves, borders)', 1, false, false),
    (v_pid, 'Pavers compacted after placement', 2, false, false),
    (v_pid, 'Polymeric joint sand applied and activated', 3, true, false),
    (v_pid, 'Edge restraint installed and secured', 4, false, false),
    (v_pid, 'Final cleanup and walkthrough complete', 5, true, false);

  -- ── RETAINING WALLS ─────────────────────────────────────────────────────────
  INSERT INTO phase_templates (job_type, name) VALUES ('retaining_walls', 'Retaining Walls') RETURNING id INTO v_tid;

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Demo, Prep and Excavation', 0) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Existing materials demolished and removed', 0, true, false),
    (v_pid, 'Trench excavated to proper footer depth', 1, false, false),
    (v_pid, 'Grading verified for drainage behind wall', 2, false, false),
    (v_pid, 'Site cleared and ready for base', 3, false, true);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Base and Compaction', 1) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, '#57 stone base layer installed in trench', 0, false, false),
    (v_pid, 'Paver base installed on top of stone', 1, false, false),
    (v_pid, 'Base compacted and verified level', 2, true, false),
    (v_pid, 'First course of wall block set and leveled', 3, false, false);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Wall Construction', 2) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Wall block courses stacked to specified height', 0, true, false),
    (v_pid, 'Geotextile fabric installed behind wall (walls >2.5 ft)', 1, false, true),
    (v_pid, 'Gravel fill placed within block cells', 2, false, false),
    (v_pid, 'Drainage stone and perforated pipe installed behind wall', 3, false, false),
    (v_pid, 'Caps installed on top course', 4, true, false),
    (v_pid, 'Backfill completed and graded', 5, true, false);

  -- ── OUTDOOR KITCHENS ────────────────────────────────────────────────────────
  INSERT INTO phase_templates (job_type, name) VALUES ('outdoor_kitchen', 'Outdoor Kitchen') RETURNING id INTO v_tid;

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Concrete Base', 0) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Concrete pad poured and cured for island footprint', 0, true, false),
    (v_pid, 'Pad dimensions verified against approved layout', 1, false, false),
    (v_pid, 'Pad level and cured — ready for CMU', 2, false, true);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'CMU Block Structure', 1) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'CMU blocks stacked to shape of structure per layout', 0, true, false),
    (v_pid, 'Blocks cut to accommodate appliance openings, doors, access panels', 1, false, false),
    (v_pid, 'Rebar and grout installed in cells', 2, false, false),
    (v_pid, 'Structure plumb, level, and ready for utilities', 3, true, false);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Utilities', 2) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Electrical rough-in completed (outlets, lighting)', 0, false, true),
    (v_pid, 'Gas line run and tested (if applicable)', 1, false, true),
    (v_pid, 'Water supply and drain installed (if sink included)', 2, false, false);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Finishing', 3) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Stucco or stone veneer applied to all faces', 0, true, false),
    (v_pid, 'Countertop fabricated and installed', 1, true, false),
    (v_pid, 'Appliances, doors, and access panels installed', 2, false, false),
    (v_pid, 'All connections tested and functional (gas, electric, water)', 3, false, false),
    (v_pid, 'Final cleanup and walkthrough complete', 4, true, false);

  -- ── CONCRETE STANDARD ───────────────────────────────────────────────────────
  INSERT INTO phase_templates (job_type, name) VALUES ('concrete_standard', 'Concrete (Standard Broom Finish)') RETURNING id INTO v_tid;

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Demolition and Excavation', 0) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, '6" of dirt/existing material excavated and removed', 0, true, false),
    (v_pid, 'Subgrade graded for drainage', 1, false, false),
    (v_pid, 'Haul-off completed, dump receipt on file', 2, false, false);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Base and Forming', 1) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, '2" of #57 stone installed and compacted', 0, false, false),
    (v_pid, 'Rebar grid laid and secured with chairs', 1, true, false),
    (v_pid, 'Forms set, staked, and verified for grade and alignment', 2, true, false),
    (v_pid, 'Expansion joints placed where required', 3, false, false);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Pour and Finish', 2) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Concrete poured to 4" depth', 0, true, false),
    (v_pid, 'Surface smoothed and floated', 1, false, false),
    (v_pid, 'Broom finish applied', 2, false, false),
    (v_pid, 'Control joints cut', 3, false, false),
    (v_pid, 'Forms stripped and final cleanup complete', 4, true, false);

  -- ── CONCRETE STAMPED ────────────────────────────────────────────────────────
  INSERT INTO phase_templates (job_type, name) VALUES ('concrete_stamped', 'Concrete (Stamped)') RETURNING id INTO v_tid;

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Demo, Base, and Forming', 0) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Same process as standard concrete demo, base, and forming', 0, false, false),
    (v_pid, 'Color hardener and release agent on site and confirmed', 1, false, true);

  INSERT INTO phase_template_phases (template_id, label, order_index) VALUES (v_tid, 'Pour, Stamp, and Finish', 1) RETURNING id INTO v_pid;
  INSERT INTO phase_template_tasks (template_phase_id, label, order_index, photo_required, note_required) VALUES
    (v_pid, 'Concrete poured to 4" depth', 0, false, false),
    (v_pid, 'Release agent applied to surface', 1, true, false),
    (v_pid, 'Stamp pattern applied per approved design', 2, true, false),
    (v_pid, 'Control joints cut after stamping', 3, false, false),
    (v_pid, 'Forms stripped, excess release washed, final cleanup', 4, true, false);

END;
$$;
