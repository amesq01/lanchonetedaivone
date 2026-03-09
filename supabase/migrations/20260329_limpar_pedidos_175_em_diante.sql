-- ============================================
-- Limpar pedidos de teste #175 em diante
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query).
-- O próximo pedido criado será o #175.
-- ============================================
-- Remove: notificações desses pedidos, itens, pedidos >= 175 e comandas que ficarem vazias.
-- Reinicia: sequência do número do pedido para 175.
-- ============================================

BEGIN;

-- Comandas que tinham algum pedido >= 175 (para limpar as que ficarem vazias)
CREATE TEMP TABLE _comandas_afetadas AS
SELECT DISTINCT comanda_id AS id
FROM pedidos
WHERE numero >= 175 AND comanda_id IS NOT NULL;

-- 1) Itens dos pedidos >= 175
DELETE FROM pedido_itens
WHERE pedido_id IN (SELECT id FROM pedidos WHERE numero >= 175);

-- 2) Pedidos >= 175 (notificações são removidas em cascata)
DELETE FROM pedidos
WHERE numero >= 175;

-- 3) Comandas que ficaram sem nenhum pedido (pagamentos saem em cascata)
DELETE FROM comandas
WHERE id IN (SELECT id FROM _comandas_afetadas)
  AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.comanda_id = comandas.id);

-- 4) Próximo pedido será #175
ALTER SEQUENCE IF EXISTS pedidos_numero_seq RESTART WITH 175;

COMMIT;
