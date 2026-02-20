-- Categorias para produtos (loja online)
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categorias (nome, ordem) VALUES ('Sushis', 1), ('Lanches', 2), ('Bebidas', 3), ('Combos', 4)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL;

-- Ponto de referência no pedido online
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ponto_referencia TEXT;

-- Controle de impressão para entrega (pedido online)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS imprimido_entrega_em TIMESTAMPTZ;
