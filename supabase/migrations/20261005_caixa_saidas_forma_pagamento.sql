-- Forma de pagamento nas saídas do caixa (pix, dinheiro, débito, crédito)
ALTER TABLE caixa_saidas
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
