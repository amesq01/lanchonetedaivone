-- Catálogo da loja online: permitir leitura de todos os produtos (public/anon)
-- para listar itens inativos ou sem estoque com máscara “indisponível”.
-- Preço e dados já eram expostos para itens ativos; escrita continua só via staff.
DROP POLICY IF EXISTS "Produtos public read" ON produtos;
CREATE POLICY "Produtos public read" ON produtos FOR SELECT USING (true);
