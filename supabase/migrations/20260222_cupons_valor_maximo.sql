-- Valor máximo do desconto em reais (teto). NULL = sem limite.
ALTER TABLE cupons ADD COLUMN IF NOT EXISTS valor_maximo DECIMAL(10,2) NULL;
