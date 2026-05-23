-- Fluxo de caixa: categorias de saída e lançamentos manuais (entradas = vendas automáticas)

CREATE TABLE IF NOT EXISTS caixa_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caixa_saidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES caixa_categorias(id) ON DELETE RESTRICT,
  data DATE NOT NULL,
  valor DECIMAL(12, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixa_saidas_data ON caixa_saidas(data);
CREATE INDEX IF NOT EXISTS idx_caixa_saidas_categoria ON caixa_saidas(categoria_id);

ALTER TABLE caixa_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_saidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caixa_categorias staff full" ON caixa_categorias FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "caixa_saidas staff full" ON caixa_saidas FOR ALL USING (public.get_my_profile_role() IS NOT NULL);

INSERT INTO caixa_categorias (nome, ordem) VALUES
  ('Compras de insumos', 1),
  ('Salários de funcionários', 2),
  ('Energia', 3),
  ('MEI', 4),
  ('SUPABASE', 5)
ON CONFLICT (nome) DO NOTHING;
