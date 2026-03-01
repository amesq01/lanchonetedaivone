-- Campo de ingredientes do produto (exibido antes de acompanhamentos no cadastro)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ingredientes TEXT;
