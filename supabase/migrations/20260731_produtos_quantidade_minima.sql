-- Quantidade mínima de pedido por produto (loja online, mesa e viagem).
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS quantidade_minima INT NOT NULL DEFAULT 1;

ALTER TABLE produtos
  DROP CONSTRAINT IF EXISTS produtos_quantidade_minima_check;

ALTER TABLE produtos
  ADD CONSTRAINT produtos_quantidade_minima_check CHECK (quantidade_minima >= 1);

-- Sashimi de salmão (código 011): mínimo 3 peças
UPDATE produtos SET quantidade_minima = 3 WHERE codigo = '011';
