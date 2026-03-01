-- O trigger roda no contexto do usuário (cozinha); RLS bloqueava o INSERT.
-- SECURITY DEFINER faz o trigger rodar com privilégios do owner (postgres), permitindo o INSERT.
CREATE OR REPLACE FUNCTION fn_notificar_atendente_pedido_finalizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atendente_id UUID;
  v_mesa_info TEXT;
  v_cliente TEXT;
  v_mensagem TEXT;
BEGIN
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') AND NEW.comanda_id IS NOT NULL THEN
    SELECT c.atendente_id, COALESCE(m.nome, 'Mesa ' || m.numero), c.nome_cliente
      INTO v_atendente_id, v_mesa_info, v_cliente
      FROM comandas c
      LEFT JOIN mesas m ON m.id = c.mesa_id
      WHERE c.id = NEW.comanda_id;
    IF v_atendente_id IS NOT NULL THEN
      v_mensagem := 'Pedido #' || NEW.numero || ' - ' || v_mesa_info || ' - ' || COALESCE(v_cliente, '-') || ': finalizado pela cozinha.';
      INSERT INTO notificacoes (atendente_id, pedido_id, pedido_numero, tipo, mensagem)
      VALUES (v_atendente_id, NEW.id, NEW.numero, 'pedido_finalizado', v_mensagem);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
