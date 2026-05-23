-- ============================================================
-- 006 — Fix infinite recursion in teams RLS policies
-- team_members_read queried team_members itself → infinite recursion.
-- Fix: security definer function bypasses RLS for the inner lookup.
-- ============================================================

-- Helper: returns team IDs the current user belongs to, without triggering RLS
CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$;

-- Helper: returns user IDs that share a team with the current user
CREATE OR REPLACE FUNCTION get_my_team_member_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT tm2.user_id
  FROM team_members tm1
  JOIN team_members tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.user_id = auth.uid()
$$;

-- Fix team_members_read (was self-referential → recursion)
DROP POLICY IF EXISTS "team_members_read" ON team_members;
CREATE POLICY "team_members_read" ON team_members FOR SELECT
  USING (team_id IN (SELECT get_my_team_ids()));

-- Fix teams_read (added in 005, queried team_members → recursion)
DROP POLICY IF EXISTS "teams_read" ON teams;
CREATE POLICY "teams_read" ON teams FOR SELECT
  USING (id IN (SELECT get_my_team_ids()));

-- Fix team_reactions_team (queried team_members → recursion)
DROP POLICY IF EXISTS "team_reactions_team" ON team_reactions;
CREATE POLICY "team_reactions_team" ON team_reactions FOR ALL
  USING (team_id IN (SELECT get_my_team_ids()));

-- Fix team_nudges policies (004) — same issue
DROP POLICY IF EXISTS "team_nudges_read" ON team_nudges;
DROP POLICY IF EXISTS "team_nudges_insert" ON team_nudges;
CREATE POLICY "team_nudges_read" ON team_nudges FOR SELECT
  USING (team_id IN (SELECT get_my_team_ids()));
CREATE POLICY "team_nudges_insert" ON team_nudges FOR INSERT WITH CHECK (
  from_user_id = auth.uid() AND
  team_id IN (SELECT get_my_team_ids())
);

-- Fix sessions_team_read (004) — joined team_members twice → recursion
DROP POLICY IF EXISTS "sessions_team_read" ON workout_sessions;
CREATE POLICY "sessions_team_read" ON workout_sessions FOR SELECT
  USING (user_id IN (SELECT get_my_team_member_ids()));
