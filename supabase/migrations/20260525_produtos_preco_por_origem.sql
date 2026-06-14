-- Preços diferenciados: consumo na casa vs viagem/online (com embalagem)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS valor_na_casa DECIMAL(10,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS em_promocao_na_casa BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS valor_promocional_na_casa DECIMAL(10,2);

COMMENT ON COLUMN produtos.valor IS 'Preço viagem/online (com embalagem)';
COMMENT ON COLUMN produtos.valor_na_casa IS 'Preço consumo no local (presencial); NULL usa valor';
