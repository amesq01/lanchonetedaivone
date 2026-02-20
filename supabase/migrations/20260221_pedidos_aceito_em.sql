-- Data em que o admin aceitou o pedido online (para tempo na cozinha contar a partir do aceite)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS aceito_em TIMESTAMPTZ;
