-- Corrige pedidos com encerrado_em incorreto (comanda ainda aberta).
-- encerrado_em deve ser preenchido apenas quando o pagamento for recebido (mesa fechada ou pedido online encerrado).
-- Antes, a cozinha ao finalizar setava encerrado_em em mesa/viagem; isso era incorreto.
UPDATE pedidos p
SET encerrado_em = NULL
FROM comandas c
WHERE p.comanda_id = c.id
  AND c.aberta = true
  AND p.status = 'finalizado'
  AND p.encerrado_em IS NOT NULL
  AND p.origem IN ('presencial', 'viagem');
