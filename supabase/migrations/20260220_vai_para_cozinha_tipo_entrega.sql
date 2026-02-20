-- Produto: vai para cozinha (preparo) ou não (ex: bebida enlatada)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS vai_para_cozinha BOOLEAN DEFAULT TRUE;

-- Pedido online: entrega (com taxa) ou retirada (grátis)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_entrega TEXT CHECK (tipo_entrega IS NULL OR tipo_entrega IN ('entrega', 'retirada'));
