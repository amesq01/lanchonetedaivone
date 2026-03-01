-- Notificações para o atendente quando a cozinha finaliza um pedido
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendente_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  pedido_numero INT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pedido_finalizado',
  mensagem TEXT NOT NULL,
  visto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_atendente_visto ON notificacoes(atendente_id, visto);

-- Trigger: quando pedido muda para finalizado, notifica o atendente da comanda
CREATE OR REPLACE FUNCTION fn_notificar_atendente_pedido_finalizado()
RETURNS TRIGGER AS $$
DECLARE
  v_atendente_id UUID;
BEGIN
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') AND NEW.comanda_id IS NOT NULL THEN
    SELECT atendente_id INTO v_atendente_id FROM comandas WHERE id = NEW.comanda_id;
    IF v_atendente_id IS NOT NULL THEN
      INSERT INTO notificacoes (atendente_id, pedido_id, pedido_numero, tipo, mensagem)
      VALUES (v_atendente_id, NEW.id, NEW.numero, 'pedido_finalizado', 'Pedido #' || NEW.numero || ' finalizado pela cozinha.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificar_atendente_pedido_finalizado ON pedidos;
CREATE TRIGGER trg_notificar_atendente_pedido_finalizado
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_notificar_atendente_pedido_finalizado();

-- RLS: atendente só vê suas próprias notificações
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendente vê suas notificações"
  ON notificacoes FOR SELECT
  USING (auth.uid() = atendente_id);

CREATE POLICY "Atendente marca como visto"
  ON notificacoes FOR UPDATE
  USING (auth.uid() = atendente_id)
  WITH CHECK (auth.uid() = atendente_id);

-- Habilitar Realtime para notificações (atendente recebe em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
