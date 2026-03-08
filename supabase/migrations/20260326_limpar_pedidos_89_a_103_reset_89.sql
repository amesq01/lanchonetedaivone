-- ============================================
-- Limpar pedidos de teste #89 a #103 e voltar contagem para 89
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query).
-- O próximo pedido criado será o #89.
-- ============================================
-- Remove: notificações desses pedidos, itens, pedidos 89-103 e comandas que ficarem vazias.
-- Reinicia: sequência do número do pedido para 89.
-- ============================================

BEGIN;

-- Comandas que tinham algum pedido 89-103 (para limpar as que ficarem vazias)
CREATE TEMP TABLE _comandas_afetadas AS
SELECT DISTINCT comanda_id AS id
FROM pedidos
WHERE numero BETWEEN 89 AND 103 AND comanda_id IS NOT NULL;

-- 1) Itens dos pedidos 89-103
DELETE FROM pedido_itens
WHERE pedido_id IN (SELECT id FROM pedidos WHERE numero BETWEEN 89 AND 103);

-- 2) Pedidos 89-103 (notificações são removidas em cascata)
DELETE FROM pedidos
WHERE numero BETWEEN 89 AND 103;

-- 3) Comandas que ficaram sem nenhum pedido (pagamentos saem em cascata)
DELETE FROM comandas
WHERE id IN (SELECT id FROM _comandas_afetadas)
  AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.comanda_id = comandas.id);

-- 4) Próximo pedido será #89
ALTER SEQUENCE IF EXISTS pedidos_numero_seq RESTART WITH 89;

COMMIT;
