
CREATE TYPE public.team_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.recipe_team_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, team_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_team_shares TO authenticated;
GRANT ALL ON public.recipe_team_shares TO service_role;
ALTER TABLE public.recipe_team_shares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.recipe_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_comments TO authenticated;
GRANT ALL ON public.recipe_comments TO service_role;
ALTER TABLE public.recipe_comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_member(_team uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.team_role_of(_team uuid, _user uuid)
RETURNS public.team_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.team_members WHERE team_id = _team AND user_id = _user
$$;

CREATE OR REPLACE FUNCTION public.can_view_recipe(_recipe uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = _recipe AND r.owner_id = _user)
      OR EXISTS (SELECT 1 FROM public.recipe_shares s WHERE s.recipe_id = _recipe AND s.shared_with = _user)
      OR EXISTS (
        SELECT 1 FROM public.recipe_team_shares ts
        JOIN public.team_members tm ON tm.team_id = ts.team_id
        WHERE ts.recipe_id = _recipe AND tm.user_id = _user
      )
$$;

-- teams
CREATE POLICY "Members view teams" ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member(teams.id, auth.uid()));
CREATE POLICY "Anyone create team" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner update team" ON public.teams FOR UPDATE TO authenticated
  USING (public.team_role_of(teams.id, auth.uid()) = 'owner')
  WITH CHECK (public.team_role_of(teams.id, auth.uid()) = 'owner');
CREATE POLICY "Owner delete team" ON public.teams FOR DELETE TO authenticated
  USING (public.team_role_of(teams.id, auth.uid()) = 'owner');

-- team_members
CREATE POLICY "Members view team members" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_team_member(team_members.team_id, auth.uid()));
CREATE POLICY "Admins add members" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.team_role_of(team_members.team_id, auth.uid()) IN ('owner', 'admin'));
CREATE POLICY "Admins update roles" ON public.team_members FOR UPDATE TO authenticated
  USING (public.team_role_of(team_members.team_id, auth.uid()) IN ('owner', 'admin'))
  WITH CHECK (public.team_role_of(team_members.team_id, auth.uid()) IN ('owner', 'admin'));
CREATE POLICY "Admins or self remove" ON public.team_members FOR DELETE TO authenticated
  USING (public.team_role_of(team_members.team_id, auth.uid()) IN ('owner', 'admin') OR team_members.user_id = auth.uid());

-- team_invites
CREATE POLICY "Admins view invites" ON public.team_invites FOR SELECT TO authenticated
  USING (public.team_role_of(team_invites.team_id, auth.uid()) IN ('owner', 'admin'));
CREATE POLICY "Admins create invites" ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (public.team_role_of(team_invites.team_id, auth.uid()) IN ('owner', 'admin') AND invited_by = auth.uid());
CREATE POLICY "Admins update invites" ON public.team_invites FOR UPDATE TO authenticated
  USING (public.team_role_of(team_invites.team_id, auth.uid()) IN ('owner', 'admin'))
  WITH CHECK (public.team_role_of(team_invites.team_id, auth.uid()) IN ('owner', 'admin'));
CREATE POLICY "Admins delete invites" ON public.team_invites FOR DELETE TO authenticated
  USING (public.team_role_of(team_invites.team_id, auth.uid()) IN ('owner', 'admin'));

-- recipe_team_shares
CREATE POLICY "Members and owner view team shares" ON public.recipe_team_shares FOR SELECT TO authenticated
  USING (
    public.is_team_member(recipe_team_shares.team_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_team_shares.recipe_id AND r.owner_id = auth.uid())
  );
CREATE POLICY "Owner shares to team" ON public.recipe_team_shares FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_team_shares.recipe_id AND r.owner_id = auth.uid())
    AND public.is_team_member(recipe_team_shares.team_id, auth.uid())
  );
CREATE POLICY "Owner unshares" ON public.recipe_team_shares FOR DELETE TO authenticated
  USING (
    shared_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_team_shares.recipe_id AND r.owner_id = auth.uid())
  );

-- recipe_comments
CREATE POLICY "Viewers read comments" ON public.recipe_comments FOR SELECT TO authenticated
  USING (public.can_view_recipe(recipe_comments.recipe_id, auth.uid()));
CREATE POLICY "Viewers add comments" ON public.recipe_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_recipe(recipe_comments.recipe_id, auth.uid()));
CREATE POLICY "Delete own comment or recipe owner" ON public.recipe_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_comments.recipe_id AND r.owner_id = auth.uid())
  );

-- recipes: extend SELECT and UPDATE
DROP POLICY IF EXISTS "Users view own or shared recipes" ON public.recipes;
CREATE POLICY "Users view own or shared recipes" ON public.recipes FOR SELECT TO authenticated
  USING (
    recipes.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recipe_shares s WHERE s.recipe_id = recipes.id AND s.shared_with = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.recipe_team_shares ts
      JOIN public.team_members tm ON tm.team_id = ts.team_id
      WHERE ts.recipe_id = recipes.id AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users update own recipes" ON public.recipes;
CREATE POLICY "Owner or team admins update recipes" ON public.recipes FOR UPDATE TO authenticated
  USING (
    recipes.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.recipe_team_shares ts
      JOIN public.team_members tm ON tm.team_id = ts.team_id
      WHERE ts.recipe_id = recipes.id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    recipes.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.recipe_team_shares ts
      JOIN public.team_members tm ON tm.team_id = ts.team_id
      WHERE ts.recipe_id = recipes.id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- Team creation trigger: creator becomes owner
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_team_created AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- Extend handle_new_user to auto-accept pending invites by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.team_members (team_id, user_id, role)
  SELECT team_id, NEW.id, role
  FROM public.team_invites
  WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  ON CONFLICT DO NOTHING;

  UPDATE public.team_invites
  SET status = 'accepted'
  WHERE lower(email) = lower(NEW.email) AND status = 'pending';

  RETURN NEW;
END; $$;
