const TIMEZONE_BR = 'America/Sao_Paulo';
const BR_OFFSET = '-03:00';

/** Interpreta "YYYY-MM-DDTHH:mm" como horário de Brasília e retorna ISO UTC. */
export function datetimeLocalBrToUtcIso(dt: string): string | null {
  if (!dt || dt.length < 10) return null;
  const [datePart, timePart] = dt.includes('T') ? dt.split('T') : [dt.slice(0, 10), '00:00'];
  const [hh = '0', mm = '0'] = (timePart || '00:00').split(':');
  const isoBr = `${datePart.slice(0, 10)}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00${BR_OFFSET}`;
  const parsed = new Date(isoBr);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** Intervalo inclusivo em UTC (ISO) a partir dos campos datetime-local (Brasília). */
export function buildBrPeriodUtcRange(
  desdeDt: string,
  ateDt: string
): { desde: string; ate: string } | null {
  const desdeIso = datetimeLocalBrToUtcIso(desdeDt);
  if (!desdeIso) return null;

  const [ateDate, ateTime = '00:00'] = ateDt.includes('T') ? ateDt.split('T') : [ateDt.slice(0, 10), '00:00'];
  const [hh, mm] = ateTime.split(':').map((x) => parseInt(x, 10) || 0);

  // 00:00 ou 23:59 no "Até" = fim do dia civil em Brasília (evita cortar o dia quando o picker zera a hora)
  const ateEndBr =
    (hh === 0 && mm === 0) || (hh === 23 && mm === 59)
      ? `${ateDate.slice(0, 10)}T23:59:59.999${BR_OFFSET}`
      : `${ateDate.slice(0, 10)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:59.999${BR_OFFSET}`;

  const ateIso = new Date(ateEndBr).toISOString();
  if (new Date(desdeIso).getTime() > new Date(ateIso).getTime()) return null;
  return { desde: desdeIso, ate: ateIso };
}

/** @deprecated Preferir buildBrPeriodUtcRange + ISO; mantido para chamadas legadas. */
export function datetimeLocalBrToUTC(dt: string): string {
  const iso = datetimeLocalBrToUtcIso(dt);
  if (!iso) return '';
  return iso.slice(0, 19).replace('T', ' ');
}

function getHojeBr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
}

export function presetDia(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  return { desde: hoje + 'T00:00', ate: hoje + 'T23:59' };
}

export function presetSemana(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  const base = new Date(`${hoje}T00:00:00-03:00`);
  const day = base.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(base.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  const mondayStr = monday.toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
  const sundayStr = sunday.toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
  return { desde: `${mondayStr}T00:00`, ate: `${sundayStr}T23:59` };
}

export function presetMes(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  const [y, m] = hoje.slice(0, 7).split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { desde: `${hoje.slice(0, 7)}-01T00:00`, ate: `${lastStr}T23:59` };
}

export function presetAno(): { desde: string; ate: string } {
  const y = new Date().getFullYear();
  return { desde: `${y}-01-01T00:00`, ate: `${y}-12-31T23:59` };
}
