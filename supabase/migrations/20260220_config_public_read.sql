-- Loja (cliente anônimo) precisa ler config para exibir taxa de entrega no carrinho.
-- Admin continua com acesso total via política existente.
CREATE POLICY "Config public read" ON config FOR SELECT USING (true);
