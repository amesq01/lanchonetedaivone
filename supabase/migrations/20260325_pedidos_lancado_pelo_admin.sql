-- Marca pedidos lançados pelo admin na mesa de um atendente (exibir "Nome (lançada pelo admin)")
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS lancado_pelo_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pedidos.lancado_pelo_admin IS 'Quando true, o pedido foi lançado pelo admin na mesa; exibir após o nome do atendente.';
