CREATE OR REPLACE FUNCTION public.set_team_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a team';
  END IF;

  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_team_created_by_trigger ON public.teams;
CREATE TRIGGER set_team_created_by_trigger
BEFORE INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.set_team_created_by();

DROP TRIGGER IF EXISTS handle_new_team_trigger ON public.teams;
CREATE TRIGGER handle_new_team_trigger
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_team();