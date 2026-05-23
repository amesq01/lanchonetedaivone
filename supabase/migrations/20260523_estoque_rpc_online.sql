-- Baixa/restauração de estoque via RPC (checkout online é anônimo; RLS bloqueia UPDATE direto em produtos)

CREATE OR REPLACE FUNCTION public.decrementar_estoque_itens(p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agg RECORD;
  atual INT;
  pedido INT;
  nova_qtd INT;
  nome_prod TEXT;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN;
  END IF;

  FOR agg IN
    SELECT
      (elem->>'produto_id')::uuid AS produto_id,
      SUM((elem->>'quantidade')::numeric)::int AS qtd
    FROM jsonb_array_elements(p_itens) AS elem
    WHERE (elem->>'produto_id') IS NOT NULL
      AND COALESCE((elem->>'quantidade')::numeric, 0) > 0
    GROUP BY (elem->>'produto_id')::uuid
  LOOP
    pedido := agg.qtd;
    SELECT p.quantidade, COALESCE(NULLIF(TRIM(p.nome), ''), p.descricao, 'Produto')
    INTO atual, nome_prod
    FROM produtos p
    WHERE p.id = agg.produto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    atual := COALESCE(atual, 0);
    IF atual < pedido THEN
      RAISE EXCEPTION '% sem estoque suficiente. Disponível: %.', nome_prod, atual;
    END IF;

    nova_qtd := GREATEST(0, atual - pedido);
    UPDATE produtos
    SET quantidade = nova_qtd,
        ativo = (nova_qtd > 0),
        updated_at = NOW()
    WHERE id = agg.produto_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurar_estoque_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agg RECORD;
  atual INT;
  nova_qtd INT;
BEGIN
  IF public.get_my_profile_role() IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para restaurar estoque.';
  END IF;

  IF p_pedido_id IS NULL THEN
    RETURN;
  END IF;

  FOR agg IN
    SELECT pi.produto_id, SUM(pi.quantidade)::int AS qtd
    FROM pedido_itens pi
    WHERE pi.pedido_id = p_pedido_id
    GROUP BY pi.produto_id
  LOOP
    SELECT p.quantidade INTO atual
    FROM produtos p
    WHERE p.id = agg.produto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    atual := COALESCE(atual, 0);
    nova_qtd := atual + agg.qtd;
    UPDATE produtos
    SET quantidade = nova_qtd,
        ativo = true,
        updated_at = NOW()
    WHERE id = agg.produto_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrementar_estoque_itens(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restaurar_estoque_pedido(uuid) TO authenticated;
