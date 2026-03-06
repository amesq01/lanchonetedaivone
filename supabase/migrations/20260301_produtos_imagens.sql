-- Múltiplas imagens por produto (array de URLs). imagem_url continua para compatibilidade.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagens JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN produtos.imagens IS 'Array de URLs de imagens do produto. Se vazio, usa imagem_url.';
