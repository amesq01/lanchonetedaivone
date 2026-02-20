-- Campo "nome do produto" (após código) no cadastro
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';
