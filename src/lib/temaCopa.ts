const TIMEZONE_BR = 'America/Sao_Paulo';

/** Final da Copa do Mundo 2026 (19/07/2026). Tema ativo inclusive neste dia (Brasília). */
export const COPA_MUNDIAL_ULTIMO_DIA = '2026-07-19';

/** Tema Copa na loja online: ativo até o fim do dia da final (horário de Brasília). */
export function isTemaCopaMundialAtivo(now = new Date()): boolean {
  const hojeBr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
  return hojeBr <= COPA_MUNDIAL_ULTIMO_DIA;
}
