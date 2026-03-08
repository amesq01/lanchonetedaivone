-- Pagamentos parciais: quem pagou, tipo (parcial_pedidos / parcial_avulso / null = encerramento), pedido_ids para parciais por pedidos
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS nome_quem_pagou TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT CHECK (tipo IS NULL OR tipo IN ('parcial_pedidos', 'parcial_avulso')),
  ADD COLUMN IF NOT EXISTS pedido_ids JSONB;

COMMENT ON COLUMN pagamentos.nome_quem_pagou IS 'Nome de quem efetuou o pagamento (parcial ou encerramento).';
COMMENT ON COLUMN pagamentos.tipo IS 'parcial_pedidos = pagamento dos pedidos selecionados; parcial_avulso = valor avulso; NULL = pagamento no encerramento.';
COMMENT ON COLUMN pagamentos.pedido_ids IS 'Para tipo parcial_pedidos: array de UUIDs dos pedidos cobertos por este pagamento.';
