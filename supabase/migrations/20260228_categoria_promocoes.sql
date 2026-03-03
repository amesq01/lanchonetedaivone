-- Categoria PROMOÇÕES: ordem 0 para aparecer primeiro na loja (logo após "Todos")
INSERT INTO categorias (nome, ordem)
SELECT 'PROMOÇÕES', 0
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'PROMOÇÕES');
