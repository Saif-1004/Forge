-- ============================================================
-- Pumps — Initial Schema Migration
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for LIKE/iLIKE search performance

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE unit_system_enum AS ENUM ('imperial', 'metric');
CREATE TYPE unit_enum AS ENUM ('lbs', 'kg');
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'unspecified');
CREATE TYPE experience_level_enum AS ENUM ('beginner', 'novice', 'intermediate', 'advanced');
CREATE TYPE primary_goal_enum AS ENUM ('muscle', 'fat_loss', 'endurance', 'athletic', 'consistency');
CREATE TYPE meal_type_enum AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE job_status_enum AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE entitlement_tier_enum AS ENUM ('base', 'ai');
CREATE TYPE team_role_enum AS ENUM ('admin', 'member');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id                            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                         text UNIQUE NOT NULL,
  display_name                  text,
  unit_system                   unit_system_enum NOT NULL DEFAULT 'imperial',
  unit_preference               unit_enum NOT NULL DEFAULT 'lbs',
  gender                        gender_enum,
  date_of_birth                 date,
  height_cm                     numeric(5,1),
  weight_kg                     numeric(5,2),
  experience_level              experience_level_enum,
  primary_goal                  primary_goal_enum,
  training_days_per_week        int CHECK (training_days_per_week BETWEEN 1 AND 7),
  equipment_access              text[],
  goal_weight_kg                numeric(5,2),
  goal_date                     date,
  weight_change_rate_kg_per_week numeric(4,2),
  calorie_target_kcal           int,
  protein_target_g              int,
  carbs_target_g                int,
  fat_target_g                  int,
  nutrition_tracking_enabled    boolean NOT NULL DEFAULT true,
  onboarding_completed_at       timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  deleted_at                    timestamptz
);

-- ============================================================
-- EXERCISES
-- ============================================================
CREATE TABLE exercises (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  muscle_primary  text[] NOT NULL DEFAULT '{}',
  muscle_secondary text[] NOT NULL DEFAULT '{}',
  equipment       text,
  is_custom       boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ex_name_fts    ON exercises USING gin(to_tsvector('english', name));
CREATE INDEX idx_ex_muscle      ON exercises USING gin(muscle_primary);
CREATE INDEX idx_ex_created_by  ON exercises(created_by) WHERE created_by IS NOT NULL;

-- ============================================================
-- WORKOUT SESSIONS
-- ============================================================
CREATE TABLE workout_sessions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  notes       text
);

CREATE INDEX idx_ws_user_date ON workout_sessions(user_id, started_at DESC);

CREATE TABLE session_exercises (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  "order"     int NOT NULL DEFAULT 0,
  notes       text
);

CREATE INDEX idx_se_session ON session_exercises(session_id, "order");

CREATE TABLE sets (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_exercise_id   uuid NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number            int NOT NULL,
  reps                  int NOT NULL CHECK (reps BETWEEN 1 AND 999),
  weight                numeric(8,2) NOT NULL CHECK (weight >= 0),
  unit                  unit_enum NOT NULL,
  rpe                   numeric(3,1) CHECK (rpe BETWEEN 1 AND 10),
  is_warmup             boolean NOT NULL DEFAULT false,
  completed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sets_session_ex ON sets(session_exercise_id, set_number);

-- ============================================================
-- PERSONAL RECORDS (maintained incrementally, never scanned from sets)
-- ============================================================
CREATE TABLE personal_records (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises(id),
  rep_count    int NOT NULL,
  weight       numeric(8,2) NOT NULL,
  unit         unit_enum NOT NULL,
  achieved_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_user_exercise ON personal_records(user_id, exercise_id, rep_count);

-- ============================================================
-- BODY STATS
-- ============================================================
CREATE TABLE body_stats (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight       numeric(6,2) NOT NULL,
  unit         unit_enum NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bs_user_date ON body_stats(user_id, recorded_at DESC);

-- ============================================================
-- REST DAYS
-- ============================================================
CREATE TABLE rest_days (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     date NOT NULL,
  note     text,
  UNIQUE (user_id, date)
);

CREATE INDEX idx_rd_user_date ON rest_days(user_id, date);

-- ============================================================
-- WORKOUT TEMPLATES
-- ============================================================
CREATE TABLE workout_templates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE template_exercises (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises(id),
  "order"      int NOT NULL DEFAULT 0,
  target_sets  int,
  target_reps  int,
  target_rpe   numeric(3,1)
);

-- ============================================================
-- NUTRITION
-- ============================================================
CREATE TABLE foods (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                text NOT NULL,
  brand               text,
  barcode             text,
  calories_per_100g   numeric(7,2) NOT NULL,
  protein_per_100g    numeric(6,2) NOT NULL,
  carbs_per_100g      numeric(6,2) NOT NULL,
  fat_per_100g        numeric(6,2) NOT NULL,
  is_custom           boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT valid_calories CHECK (
    ABS(calories_per_100g - (protein_per_100g * 4 + carbs_per_100g * 4 + fat_per_100g * 9)) < 50
  )
);

CREATE UNIQUE INDEX idx_foods_barcode    ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX        idx_foods_name_fts   ON foods USING gin(to_tsvector('english', name));

CREATE TABLE food_logs (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id      uuid NOT NULL REFERENCES foods(id),
  meal_type    meal_type_enum NOT NULL,
  serving_g    numeric(7,2) NOT NULL CHECK (serving_g > 0),
  logged_at    timestamptz NOT NULL DEFAULT now(),
  date         date NOT NULL
);

CREATE INDEX idx_fl_user_date ON food_logs(user_id, date DESC);

CREATE TABLE water_logs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_ml  int NOT NULL CHECK (amount_ml > 0),
  logged_at  timestamptz NOT NULL DEFAULT now(),
  date       date NOT NULL
);

CREATE INDEX idx_wl_user_date ON water_logs(user_id, date DESC);

-- ============================================================
-- PRE-COMPUTED SUMMARIES
-- ============================================================
CREATE TABLE user_daily_nutrition_summary (
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                  date NOT NULL,
  total_calories_kcal   numeric(8,2) NOT NULL DEFAULT 0,
  total_protein_g       numeric(7,2) NOT NULL DEFAULT 0,
  total_carbs_g         numeric(7,2) NOT NULL DEFAULT 0,
  total_fat_g           numeric(7,2) NOT NULL DEFAULT 0,
  total_water_ml        int NOT NULL DEFAULT 0,
  meals_logged          int NOT NULL DEFAULT 0,
  computed_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE user_weekly_training_summary (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start          date NOT NULL,
  sessions_count      int NOT NULL DEFAULT 0,
  total_volume_kg     numeric(10,2) NOT NULL DEFAULT 0,
  muscle_groups_hit   text[] NOT NULL DEFAULT '{}',
  avg_duration_min    int,
  streak_at_end       int NOT NULL DEFAULT 0,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  created_by        uuid NOT NULL REFERENCES users(id),
  invite_code       text UNIQUE NOT NULL,
  invite_expires_at timestamptz,
  invite_used_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id        uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           team_role_enum NOT NULL DEFAULT 'member',
  share_history  boolean NOT NULL DEFAULT false,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX idx_tm_user_id  ON team_members(user_id);
CREATE INDEX idx_tm_team_id  ON team_members(team_id);

CREATE TABLE team_reactions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  reactor_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_weekly_leaderboard (
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessions_count  int NOT NULL DEFAULT 0,
  total_volume_kg numeric(10,2) NOT NULL DEFAULT 0,
  streak          int NOT NULL DEFAULT 0,
  rank            int NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, week_start, user_id)
);

-- ============================================================
-- SUBSCRIPTIONS (RevenueCat webhook mirror)
-- ============================================================
CREATE TABLE user_entitlements (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  text NOT NULL,
  tier        entitlement_tier_enum NOT NULL,
  expires_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- ============================================================
-- BACKGROUND JOBS
-- ============================================================
CREATE TABLE jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  payload     jsonb NOT NULL DEFAULT '{}',
  status      job_status_enum NOT NULL DEFAULT 'pending',
  attempts    int NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_pending ON jobs(status, created_at) WHERE status = 'pending';

-- ============================================================
-- SECURITY & RATE LIMITING
-- ============================================================
CREATE TABLE rate_limits (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint       text NOT NULL,
  window_start   timestamptz NOT NULL,
  request_count  int NOT NULL DEFAULT 1,
  token_count    int NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rl_user_endpoint ON rate_limits(user_id, endpoint, window_start);

CREATE TABLE security_audit_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid,
  event_type  text NOT NULL,
  ip_hash     text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created ON security_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user    ON security_audit_log(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE users                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records              ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_stats                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rest_days                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises            ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_nutrition_summary  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_training_summary  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_reactions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits                   ENABLE ROW LEVEL SECURITY;

-- Personal data: own rows only
CREATE POLICY "users_own"        ON users              FOR ALL USING (id = auth.uid());
CREATE POLICY "sessions_own"     ON workout_sessions   FOR ALL USING (user_id = auth.uid());
CREATE POLICY "body_stats_own"   ON body_stats         FOR ALL USING (user_id = auth.uid());
CREATE POLICY "rest_days_own"    ON rest_days          FOR ALL USING (user_id = auth.uid());
CREATE POLICY "templates_own"    ON workout_templates  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "food_logs_own"    ON food_logs          FOR ALL USING (user_id = auth.uid());
CREATE POLICY "water_logs_own"   ON water_logs         FOR ALL USING (user_id = auth.uid());
CREATE POLICY "pr_own"           ON personal_records   FOR ALL USING (user_id = auth.uid());
CREATE POLICY "nutrition_sum_own" ON user_daily_nutrition_summary FOR ALL USING (user_id = auth.uid());
CREATE POLICY "training_sum_own"  ON user_weekly_training_summary FOR ALL USING (user_id = auth.uid());
CREATE POLICY "entitlements_own"  ON user_entitlements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rate_limits_own"   ON rate_limits       FOR ALL USING (user_id = auth.uid());

-- session_exercises: through session ownership
CREATE POLICY "session_ex_own" ON session_exercises FOR ALL
  USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid()));

-- sets: through session_exercise → session ownership
CREATE POLICY "sets_own" ON sets FOR ALL
  USING (session_exercise_id IN (
    SELECT se.id FROM session_exercises se
    JOIN workout_sessions ws ON ws.id = se.session_id
    WHERE ws.user_id = auth.uid()
  ));

-- template_exercises: through template ownership
CREATE POLICY "template_ex_own" ON template_exercises FOR ALL
  USING (template_id IN (SELECT id FROM workout_templates WHERE user_id = auth.uid()));

-- foods: built-in (read all) + own custom foods (write own)
CREATE POLICY "foods_read_builtin" ON foods FOR SELECT USING (NOT is_custom OR created_by = auth.uid());
CREATE POLICY "foods_write_own"    ON foods FOR INSERT WITH CHECK (is_custom AND created_by = auth.uid());
CREATE POLICY "foods_update_own"   ON foods FOR UPDATE USING (is_custom AND created_by = auth.uid());
CREATE POLICY "foods_delete_own"   ON foods FOR DELETE USING (is_custom AND created_by = auth.uid());

-- exercises: built-in (read all) + own custom (write own)
CREATE POLICY "exercises_read"       ON exercises FOR SELECT USING (NOT is_custom OR created_by = auth.uid());
CREATE POLICY "exercises_write_own"  ON exercises FOR INSERT WITH CHECK (is_custom AND created_by = auth.uid());
CREATE POLICY "exercises_update_own" ON exercises FOR UPDATE USING (is_custom AND created_by = auth.uid());
CREATE POLICY "exercises_delete_own" ON exercises FOR DELETE USING (is_custom AND created_by = auth.uid());

-- team_members: members of same team
CREATE POLICY "team_members_read" ON team_members FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "team_reactions_team" ON team_reactions FOR ALL
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- security_audit_log: append-only, no SELECT/UPDATE/DELETE via RLS
CREATE POLICY "audit_insert_only" ON security_audit_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- TRIGGERS: keep pre-computed summaries current
-- ============================================================

-- After food_log change → upsert daily nutrition summary
CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user_id uuid;
  target_date    date;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  target_date    := COALESCE(NEW.date, OLD.date);

  INSERT INTO user_daily_nutrition_summary (
    user_id, date,
    total_calories_kcal, total_protein_g, total_carbs_g, total_fat_g, meals_logged, computed_at
  )
  SELECT
    fl.user_id,
    fl.date,
    COALESCE(SUM(f.calories_per_100g * fl.serving_g / 100), 0),
    COALESCE(SUM(f.protein_per_100g  * fl.serving_g / 100), 0),
    COALESCE(SUM(f.carbs_per_100g    * fl.serving_g / 100), 0),
    COALESCE(SUM(f.fat_per_100g      * fl.serving_g / 100), 0),
    COUNT(*),
    now()
  FROM food_logs fl
  JOIN foods f ON f.id = fl.food_id
  WHERE fl.user_id = target_user_id AND fl.date = target_date
  GROUP BY fl.user_id, fl.date
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_calories_kcal = EXCLUDED.total_calories_kcal,
    total_protein_g     = EXCLUDED.total_protein_g,
    total_carbs_g       = EXCLUDED.total_carbs_g,
    total_fat_g         = EXCLUDED.total_fat_g,
    meals_logged        = EXCLUDED.meals_logged,
    computed_at         = now();

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_food_log_summary
  AFTER INSERT OR UPDATE OR DELETE ON food_logs
  FOR EACH ROW EXECUTE FUNCTION update_daily_nutrition_summary();

-- Water log → update daily water total
CREATE OR REPLACE FUNCTION update_daily_water_summary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user_id uuid;
  target_date    date;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  target_date    := COALESCE(NEW.date, OLD.date);

  INSERT INTO user_daily_nutrition_summary (user_id, date, total_water_ml, computed_at)
  SELECT target_user_id, target_date, COALESCE(SUM(amount_ml), 0), now()
  FROM water_logs
  WHERE user_id = target_user_id AND date = target_date
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_water_ml = EXCLUDED.total_water_ml,
    computed_at    = now();

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_water_log_summary
  AFTER INSERT OR UPDATE OR DELETE ON water_logs
  FOR EACH ROW EXECUTE FUNCTION update_daily_water_summary();

-- PR check: after set insert, update personal_records if new max
CREATE OR REPLACE FUNCTION check_personal_record()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    uuid;
  v_exercise_id uuid;
  v_current_max numeric;
BEGIN
  SELECT ws.user_id, se.exercise_id
  INTO v_user_id, v_exercise_id
  FROM session_exercises se
  JOIN workout_sessions ws ON ws.id = se.session_id
  WHERE se.id = NEW.session_exercise_id;

  SELECT weight INTO v_current_max
  FROM personal_records
  WHERE user_id = v_user_id AND exercise_id = v_exercise_id AND rep_count = NEW.reps
  ORDER BY weight DESC LIMIT 1;

  IF v_current_max IS NULL OR NEW.weight > v_current_max THEN
    INSERT INTO personal_records (user_id, exercise_id, rep_count, weight, unit, achieved_at)
    VALUES (v_user_id, v_exercise_id, NEW.reps, NEW.weight, NEW.unit, NEW.completed_at);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_pr
  AFTER INSERT ON sets
  FOR EACH ROW
  WHEN (NOT NEW.is_warmup)
  EXECUTE FUNCTION check_personal_record();
