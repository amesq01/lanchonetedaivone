-- Remove política que permitia admin ver todas as notificações (notificações só para garçom)
DROP POLICY IF EXISTS "Admin vê todas as notificações" ON notificacoes;
