
-- Fix broken RLS policy for viewing shared recipes
DROP POLICY IF EXISTS "Users view own recipes" ON public.recipes;
CREATE POLICY "Users view own or shared recipes" ON public.recipes
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.recipe_shares s
    WHERE s.recipe_id = recipes.id AND s.shared_with = auth.uid()
  )
);

-- Add foreign keys to profiles so PostgREST joins work
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_owner_id_profiles_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_shares
  ADD CONSTRAINT recipe_shares_shared_with_profiles_fkey
  FOREIGN KEY (shared_with) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_shares
  ADD CONSTRAINT recipe_shares_shared_by_profiles_fkey
  FOREIGN KEY (shared_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
