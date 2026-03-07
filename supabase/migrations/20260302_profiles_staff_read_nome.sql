-- Permite que staff (admin, atendente, cozinha) leia id e nome de todos os profiles.
-- Necessário para exibir "Mesa aberta por [nome]" e alertas quando outro atendente já abriu a mesa.
CREATE POLICY "Staff read all profiles for display"
  ON profiles FOR SELECT
  USING (public.get_my_profile_role() IS NOT NULL);
