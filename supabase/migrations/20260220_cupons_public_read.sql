-- Clientes da loja (anon) precisam ler cupons para validar no checkout.
-- Staff continua com acesso total via política existente.
CREATE POLICY "Cupons public read" ON cupons FOR SELECT USING (true);
