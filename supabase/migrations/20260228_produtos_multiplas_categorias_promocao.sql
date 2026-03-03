-- Produtos em várias categorias (N:N)
CREATE TABLE IF NOT EXISTS produto_categorias (
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, categoria_id)
);

-- Promoção: checkbox "na promoção?" e valor promocional
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS em_promocao BOOLEAN DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS valor_promocional DECIMAL(10,2);

-- Migra categoria_id existente para produto_categorias (um produto pode já ter uma categoria)
INSERT INTO produto_categorias (produto_id, categoria_id)
  SELECT id, categoria_id FROM produtos WHERE categoria_id IS NOT NULL
  ON CONFLICT (produto_id, categoria_id) DO NOTHING;

-- RLS: loja (anon) lê; staff (admin/atendente/cozinha) gerencia
ALTER TABLE produto_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produto_categorias read all" ON produto_categorias FOR SELECT USING (true);
CREATE POLICY "produto_categorias staff full" ON produto_categorias FOR ALL USING (public.get_my_profile_role() IS NOT NULL);
