-- ============================================
-- Limpar todos os pedidos de teste e resetar a contagem
-- Use no SQL Editor do Supabase quando quiser zerar pedidos e voltar a numeração ao 1.
-- ============================================
-- Remove: notificações, itens de pedido, pedidos, comandas.
-- Reinicia: sequência do número do pedido (próximo pedido será #1).
-- Não altera: profiles, produtos, categorias, mesas, config, cupons.
-- ============================================

DELETE FROM notificacoes;
DELETE FROM pedido_itens;
UPDATE pedidos SET cupom_id = NULL;
DELETE FROM pedidos;
DELETE FROM comandas;

-- Próximo pedido criado será #1
ALTER SEQUENCE IF EXISTS pedidos_numero_seq RESTART WITH 1;
