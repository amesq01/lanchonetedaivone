-- Motivo do cancelamento (para relatório)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES auth.users(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;

-- Perfil cozinha (só kanban + sair)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'atendente', 'cozinha'));
