
CREATE OR REPLACE FUNCTION public.set_team_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_team_created_by_trigger ON public.teams;
CREATE TRIGGER set_team_created_by_trigger
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_team_created_by();

DROP POLICY IF EXISTS "Anyone create team" ON public.teams;
CREATE POLICY "Anyone create team"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
