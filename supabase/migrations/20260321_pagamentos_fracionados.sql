-- Pagamentos fracionados: cada fração (valor + forma) vinculada a uma comanda ou a um pedido online
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID REFERENCES comandas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  forma_pagamento TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pagamentos_comanda_ou_pedido CHECK (
    (comanda_id IS NOT NULL AND pedido_id IS NULL) OR
    (comanda_id IS NULL AND pedido_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_comanda ON pagamentos(comanda_id) WHERE comanda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido ON pagamentos(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_created ON pagamentos(created_at);

ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage pagamentos"
  ON pagamentos FOR ALL
  USING (public.get_my_profile_role() IN ('admin', 'atendente', 'cozinha'))
  WITH CHECK (public.get_my_profile_role() IN ('admin', 'atendente', 'cozinha'));
