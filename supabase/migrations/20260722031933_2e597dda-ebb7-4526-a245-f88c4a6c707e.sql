
-- Restore EXECUTE on helper functions to authenticated (were locked down too aggressively)
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_recipe(uuid, uuid) TO authenticated;

-- Fix infinite recursion: recipes SELECT policy referenced recipe_team_shares,
-- whose own SELECT policy referenced recipes -> loop.
-- Rewrite both to use SECURITY DEFINER helpers that bypass RLS.

DROP POLICY IF EXISTS "Users view own or shared recipes" ON public.recipes;
CREATE POLICY "Users view own or shared recipes"
  ON public.recipes FOR SELECT
  USING (public.can_view_recipe(id, auth.uid()));

-- recipe_team_shares SELECT: avoid querying recipes table under RLS.
DROP POLICY IF EXISTS "Members and owner view team shares" ON public.recipe_team_shares;
CREATE POLICY "Members and owner view team shares"
  ON public.recipe_team_shares FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()) OR shared_by = auth.uid());
