-- Telefone opcional na comanda (ao abrir mesa ou ao gerar pedido viagem)
ALTER TABLE comandas
  ADD COLUMN IF NOT EXISTS telefone TEXT;

COMMENT ON COLUMN comandas.telefone IS 'Telefone do cliente (opcional), informado ao abrir a mesa ou ao gerar pedido viagem.';
