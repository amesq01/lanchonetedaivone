-- Marcação por item na cozinha (kanban "Em preparação")
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS cozinha_preparado BOOLEAN NOT NULL DEFAULT false;
