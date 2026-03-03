-- ============================================
-- Limpar dados de pedidos e comandas para produção
-- Mantém: profiles (usuários), produtos, categorias, mesas, config, cupons
-- ============================================
-- Execute esta migration UMA VEZ no ambiente que vai para produção,
-- para apagar todos os pedidos, itens, comandas e notificações de teste.
-- ============================================

-- Ordem: tabelas que referenciam outras primeiro
DELETE FROM notificacoes;
DELETE FROM pedido_itens;
UPDATE pedidos SET cupom_id = NULL;
DELETE FROM pedidos;
DELETE FROM comandas;

-- Reinicia a numeração dos pedidos para o próximo ser #1
ALTER SEQUENCE IF EXISTS pedidos_numero_seq RESTART WITH 1;
