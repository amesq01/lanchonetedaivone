-- Permite que o admin exclua atendentes (profiles).
-- Sem esta policy, o DELETE em profiles falha por RLS.

CREATE POLICY "Admin delete profile"
  ON profiles
  FOR DELETE
  USING (public.get_my_profile_role() = 'admin');

