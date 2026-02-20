-- ============================================
-- LANCHONETE APP - Schema Supabase
-- ============================================

-- Perfis: admin, atendente (vinculado a auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'atendente', 'cozinha')),
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuração da loja (mesas, taxa entrega)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mesas (numero 0 ou 'VIAGEM' = mesa viagem)
CREATE TABLE IF NOT EXISTS mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  is_viagem BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comandas (mesa aberta = uma comanda ativa por mesa, exceto VIAGEM que tem várias)
CREATE TABLE IF NOT EXISTS comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id UUID NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  atendente_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome_cliente TEXT NOT NULL,
  aberta BOOLEAN DEFAULT TRUE,
  forma_pagamento TEXT,
  encerrada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias (loja online)
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  acompanhamentos TEXT,
  valor DECIMAL(10,2) NOT NULL,
  quantidade INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  imagem_url TEXT,
  vai_para_cozinha BOOLEAN DEFAULT TRUE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cupons de desconto
CREATE TABLE IF NOT EXISTS cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  porcentagem DECIMAL(5,2) NOT NULL,
  valido_ate DATE NOT NULL,
  quantidade_usos INT NOT NULL DEFAULT 1,
  usos_restantes INT NOT NULL DEFAULT 1,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos (cada pedido pertence a uma comanda ou é online)
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL,
  comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL,
  origem TEXT NOT NULL CHECK (origem IN ('presencial', 'viagem', 'online')),
  status TEXT NOT NULL DEFAULT 'novo_pedido' CHECK (status IN ('aguardando_aceite', 'novo_pedido', 'em_preparacao', 'finalizado', 'cancelado')),
  cliente_nome TEXT,
  cliente_whatsapp TEXT,
  cliente_endereco TEXT,
  forma_pagamento TEXT,
  troco_para DECIMAL(10,2),
  observacoes TEXT,
  cupom_id UUID REFERENCES cupons(id),
  desconto DECIMAL(10,2) DEFAULT 0,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  encerrado_em TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  cancelado_por UUID REFERENCES auth.users(id),
  cancelado_em TIMESTAMPTZ,
  tipo_entrega TEXT CHECK (tipo_entrega IS NULL OR tipo_entrega IN ('entrega', 'retirada')),
  ponto_referencia TEXT,
  imprimido_entrega_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequência para número do pedido
CREATE SEQUENCE IF NOT EXISTS pedidos_numero_seq START 1;

-- Itens do pedido
CREATE TABLE IF NOT EXISTS pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade INT NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comandas_mesa_aberta ON comandas(mesa_id) WHERE aberta = TRUE;
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_comanda ON pedidos(comanda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_origem ON pedidos(origem);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);

-- Função auxiliar para RLS: retorna a role do usuário atual sem causar recursão nas políticas
-- SECURITY DEFINER = roda com privilégios do dono, não passa pelo RLS de profiles
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

-- Políticas: admin e atendente leem/escrevem; anônimo só lê produtos (loja online)
-- Usar get_my_profile_role() evita recursão infinita (policy em profiles que lia profiles)
CREATE POLICY "Profiles read own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin read all profiles" ON profiles FOR SELECT USING (public.get_my_profile_role() = 'admin');
CREATE POLICY "Admin insert profile" ON profiles FOR INSERT WITH CHECK (public.get_my_profile_role() = 'admin');
CREATE POLICY "Admin update profile" ON profiles FOR UPDATE USING (public.get_my_profile_role() = 'admin');
CREATE POLICY "Admin full config" ON config FOR ALL USING (public.get_my_profile_role() = 'admin');
CREATE POLICY "Staff full mesas" ON mesas FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Staff full comandas" ON comandas FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Produtos public read" ON produtos FOR SELECT USING (ativo = TRUE);
CREATE POLICY "Staff full produtos" ON produtos FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Staff full cupons" ON cupons FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Pedidos staff" ON pedidos FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Pedidos online insert" ON pedidos FOR INSERT WITH CHECK (origem = 'online');
CREATE POLICY "Pedidos online select" ON pedidos FOR SELECT USING (origem = 'online');
CREATE POLICY "Pedido itens staff" ON pedido_itens FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "Pedido itens insert online" ON pedido_itens FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_id AND p.origem = 'online'));
CREATE POLICY "Pedido itens select" ON pedido_itens FOR SELECT USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_id AND p.origem = 'online'));

-- Função para próximo número de pedido
CREATE OR REPLACE FUNCTION next_pedido_numero()
RETURNS INT AS $$
  SELECT nextval('pedidos_numero_seq')::INT;
$$ LANGUAGE SQL;

-- Inserir config inicial
INSERT INTO config (key, value) VALUES 
  ('taxa_entrega', '0'),
  ('quantidade_mesas', '10')
ON CONFLICT (key) DO NOTHING;

-- Trigger: criar perfil automaticamente quando um usuário é criado no Auth
-- Novos usuários entram como 'atendente'. Para virar admin: UPDATE profiles SET role = 'admin' WHERE email = 'seu@email.com';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, nome, email)
  VALUES (
    NEW.id,
    'atendente',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Usuário'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
