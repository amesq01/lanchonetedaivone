-- Marca pedido online já pago (impressão sem QR PIX, com selo "PEDIDO PAGO").
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pedido_pago boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pedidos.pedido_pago IS 'Pedidos online: quando true, comprovante imprime PEDIDO PAGO no lugar do QR Code PIX.';
