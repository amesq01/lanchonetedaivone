import { useEffect, useState } from 'react';
import { getRelatorioCancelamentos } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';

/** Converte "YYYY-MM-DDTHH:mm" (Brasília) para UTC ISO. */
function datetimeLocalBrToUTCISO(dt: string): string {
  if (!dt || dt.length < 16) return '';
  const [datePart, timePart] = dt.split('T');
  const [y, m, d] = datePart.slice(0, 10).split('-').map(Number);
  const [hh = 0, mm = 0] = (timePart || '00:00').split(':').map(Number);
  const brAsUTC = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  return new Date(brAsUTC.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

function getHojeBr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
}

function presetDia(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  return { desde: hoje + 'T00:00', ate: hoje + 'T23:59' };
}

function presetMes(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  const [y, m] = hoje.slice(0, 7).split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { desde: `${hoje.slice(0, 7)}-01T00:00`, ate: `${lastStr}T23:59` };
}

function presetAno(): { desde: string; ate: string } {
  const y = new Date().getFullYear();
  return { desde: `${y}-01-01T00:00`, ate: `${y}-12-31T23:59` };
}

export default function RelatorioCancelamentos() {
  const [desdeDateTime, setDesdeDateTime] = useState(() => presetDia().desde);
  const [ateDateTime, setAteDateTime] = useState(() => presetDia().ate);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalComparar, setTotalComparar] = useState<number | null>(null);
  const [compararLoading, setCompararLoading] = useState(false);

  useEffect(() => {
    setTotalComparar(null);
  }, [desdeDateTime, ateDateTime]);

  const carregarPeriodo = (desdeDt: string, ateDt: string) => {
    const desde = datetimeLocalBrToUTCISO(desdeDt);
    const ate = datetimeLocalBrToUTCISO(ateDt);
    if (!desde || !ate) return;
    setLoading(true);
    setTotalComparar(null);
    getRelatorioCancelamentos(desde, ate)
      .then((r) => setItens(r.itens))
      .finally(() => setLoading(false));
  };

  const handleComparar = () => {
    const desde = datetimeLocalBrToUTCISO(desdeDateTime);
    const ate = datetimeLocalBrToUTCISO(ateDateTime);
    if (!desde || !ate) return;
    setLoading(true);
    setCompararLoading(true);
    const desdeMs = new Date(desde).getTime();
    const ateMs = new Date(ate).getTime();
    const duracaoMs = ateMs - desdeMs;
    const ate2Ms = desdeMs - 1000;
    const desde2Ms = ate2Ms - duracaoMs;
    const desde2 = new Date(desde2Ms).toISOString();
    const ate2 = new Date(ate2Ms).toISOString();
    Promise.all([
      getRelatorioCancelamentos(desde, ate),
      getRelatorioCancelamentos(desde2, ate2),
    ])
      .then(([r1, r2]) => {
        setItens(r1.itens);
        setTotalComparar(r2.itens.length);
      })
      .finally(() => {
        setLoading(false);
        setCompararLoading(false);
      });
  };

  const tituloPeriodo =
    desdeDateTime && ateDateTime
      ? `${new Date(desdeDateTime.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} ${desdeDateTime.slice(11, 16)} – ${new Date(ateDateTime.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} ${ateDateTime.slice(11, 16)}`
      : '—';

  const variacaoCancelamentos =
    totalComparar != null && totalComparar > 0
      ? ((itens.length - totalComparar) / totalComparar) * 100
      : totalComparar === 0 && itens.length > 0
        ? 100
        : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório de cancelamentos</h1>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetDia();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
                carregarPeriodo(desde, ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetMes();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
                carregarPeriodo(desde, ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetAno();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
                carregarPeriodo(desde, ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Anual
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">De</label>
            <input
              type="datetime-local"
              value={desdeDateTime}
              onChange={(e) => setDesdeDateTime(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Até</label>
            <input
              type="datetime-local"
              value={ateDateTime}
              onChange={(e) => setAteDateTime(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleComparar}
            disabled={compararLoading}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {compararLoading ? 'Buscando...' : 'Comparar'}
          </button>
        </div>
      </div>
      {totalComparar != null && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm">
          <h2 className="text-sm font-medium text-amber-800 mb-3">Comparação com período anterior</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-stone-500">Período selecionado</p>
              <p className="font-semibold text-stone-800">{tituloPeriodo}</p>
              <p className="text-stone-700">{itens.length} cancelamentos</p>
            </div>
            <div>
              <p className="text-stone-500">Intervalo anterior (mesma duração)</p>
              <p className="text-stone-700">{totalComparar} cancelamentos</p>
            </div>
            <div>
              <p className="text-stone-500">Variação</p>
              {variacaoCancelamentos != null && (
                <p className={`font-medium ${variacaoCancelamentos >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {variacaoCancelamentos >= 0 ? '+' : ''}{variacaoCancelamentos.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <p className="text-sm text-stone-500 mb-4">
        Período: <strong>{tituloPeriodo}</strong> (horário de Brasília)
      </p>
      {loading ? (
        <p className="text-stone-500">Carregando...</p>
      ) : (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Data/hora</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pedido #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Origem</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Atendente (realizou)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Quem cancelou</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((p) => (
                <tr key={p.id} className="border-b border-stone-100">
                  <td className="px-4 py-2 text-sm">{p.cancelado_em ? new Date(p.cancelado_em).toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-4 py-2">{p.numero}</td>
                  <td className="px-4 py-2 text-sm">{p.origem}</td>
                  <td className="px-4 py-2 text-sm">{p.atendente_nome ?? '-'}</td>
                  <td className="px-4 py-2 text-sm">{p.cancelado_por_nome ?? '-'}</td>
                  <td className="px-4 py-2 text-sm max-w-xs">{p.motivo_cancelamento ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {itens.length === 0 && !loading && (
            <p className="p-4 text-stone-500 text-center">Nenhum cancelamento no período.</p>
          )}
        </div>
      )}
    </div>
  );
}
