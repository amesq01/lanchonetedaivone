-- ============================================
-- CORREÇÃO: recursão infinita nas políticas RLS de profiles
-- Rode este arquivo no SQL Editor do Supabase (uma vez)
-- ============================================

-- 1. Função que retorna a role do usuário SEM passar pelo RLS (evita recursão)
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Admin read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin insert profile" ON profiles;
DROP POLICY IF EXISTS "Admin update profile" ON profiles;
DROP POLICY IF EXISTS "Admin full config" ON config;
DROP POLICY IF EXISTS "Staff full mesas" ON mesas;
DROP POLICY IF EXISTS "Staff full comandas" ON comandas;
DROP POLICY IF EXISTS "Staff full produtos" ON produtos;
DROP POLICY IF EXISTS "Staff full cupons" ON cupons;
DROP POLICY IF EXISTS "Pedidos staff" ON pedidos;
DROP POLICY IF EXISTS "Pedido itens staff" ON pedido_itens;

-- 3. Recriar políticas usando get_my_profile_role() (sem recursão)
CREATE POLICY "Admin read all profiles" ON profiles FOR SELECT USING (public.get_my_profile_role() = 'admin');
CREATE POLICY "Admin insert profile" ON profiles FOR INSERT WITH CHECK (public.get_my_profile_role() = 'admin');
CREATE POLICY "Admin update profile" ON profiles FOR UPDATE USING (public.get_my_profile_role() = 'admin');
CREATE POLICY "Admin full config" ON config FOR ALL USING (public.get_my_profile_role() = 'admin');
CREATE POLICY "Staff full mesas" ON mesas FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Staff full comandas" ON comandas FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Staff full produtos" ON produtos FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Staff full cupons" ON cupons FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Pedidos staff" ON pedidos FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Pedido itens staff" ON pedido_itens FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
