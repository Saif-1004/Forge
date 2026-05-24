-- ============================================================
-- 008 — Fix teams SELECT visibility for creator and invite lookup
--
-- Problem A: INSERT INTO teams ... RETURNING * fails because
-- teams_read USING policy checks team_members, but the user
-- hasn't been added to team_members yet at RETURNING time.
-- Fix: also allow SELECT for the team's creator.
--
-- Problem B: joining by invite_code does a SELECT on teams,
-- but teams_read only shows teams the user is already in.
-- Fix: SECURITY DEFINER function bypasses RLS for invite lookup.
-- ============================================================

-- Allow creator to see their own team (fixes INSERT...RETURNING)
DROP POLICY IF EXISTS "teams_read" ON teams;
CREATE POLICY "teams_read" ON teams FOR SELECT
  USING (
    id IN (SELECT get_my_team_ids())
    OR created_by = auth.uid()
  );

-- Invite-code lookup — bypasses RLS so any authed user can find a team
CREATE OR REPLACE FUNCTION find_team_by_invite_code(p_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, name FROM teams WHERE invite_code = upper(p_code)
$$;
