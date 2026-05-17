/**
 * Monta PIX Copia e Cola (BR Code) com valor fixo no campo EMV 54.
 * Payload base: chave PIX da lanchonete (sem campo 54; CRC recalculado a cada impressão).
 */
const PIX_PAYLOAD_SEM_CRC =
  '00020101021126580014br.gov.bcb.pix013627ed7096-d278-4665-9370-ddc18aea9c805204000053039865802BR5925JOAO BATISTA DE SOUSA MES6009SAO PAULO622905251KRVYGPT6K64YQE14P6SSWY2B';

function emvTag(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC16-CCITT-FALSE (padrão PIX / EMV BR Code). */
function crc16Pix(payload: string): string {
  let crc = 0xffff;
  const polynom = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ polynom) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function appendCrc(payloadSemCampo63: string): string {
  const paraCrc = payloadSemCampo63 + '6304';
  return paraCrc + crc16Pix(paraCrc);
}

/** Valor em reais → string do campo 54 (ex.: "45.90"). */
function formatarValorPix(valor: number): string {
  const v = Math.max(0, Math.round(valor * 100) / 100);
  return v.toFixed(2);
}

/**
 * Gera PIX Copia e Cola com valor preenchido para o app do banco (campo 54).
 * Se valor ≤ 0, retorna o payload estático original (cliente digita o valor).
 */
export function buildPixCopiaCola(valorReais?: number): string {
  if (valorReais == null || valorReais < 0.01) {
    return appendCrc(PIX_PAYLOAD_SEM_CRC);
  }
  const amountField = emvTag('54', formatarValorPix(valorReais));
  const insertAfter = '5303986';
  const idx = PIX_PAYLOAD_SEM_CRC.indexOf(insertAfter);
  if (idx === -1) return appendCrc(PIX_PAYLOAD_SEM_CRC);
  const comValor =
    PIX_PAYLOAD_SEM_CRC.slice(0, idx + insertAfter.length) +
    amountField +
    PIX_PAYLOAD_SEM_CRC.slice(idx + insertAfter.length);
  return appendCrc(comValor);
}
