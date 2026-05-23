-- CMV: insumos e ficha técnica por produto
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL CHECK (unidade IN ('un', 'kg', 'g', 'L', 'ml')),
  custo_unitario DECIMAL(10, 4) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produto_insumos (
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  quantidade DECIMAL(12, 4) NOT NULL CHECK (quantidade > 0),
  PRIMARY KEY (produto_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_insumos_insumo ON produto_insumos(insumo_id);

ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insumos staff full" ON insumos FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
CREATE POLICY "produto_insumos staff full" ON produto_insumos FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
