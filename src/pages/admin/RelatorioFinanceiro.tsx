import { useEffect, useState } from 'react';
import { getRelatorioFinanceiro } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';

/** Retorna início e fim do período em UTC (meia-noite a meia-noite em Brasília, UTC-3). Formato para o backend: "YYYY-MM-DD HH:mm:ss". */
function periodoParaUTC(periodo: 'dia' | 'mes' | 'ano', dataRef: string): { desde: string; ate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  if (periodo === 'dia') {
    const [y, m, d] = dataRef.slice(0, 10).split('-').map(Number);
    const desde = fmt(new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0)));
    const ate = fmt(new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0, 0)));
    return { desde, ate };
  }
  if (periodo === 'mes') {
    const [y, m] = dataRef.slice(0, 7).split('-').map(Number);
    const desde = fmt(new Date(Date.UTC(y, m - 1, 1, 3, 0, 0, 0)));
    const ate = fmt(new Date(Date.UTC(y, m, 1, 3, 0, 0, 0)));
    return { desde, ate };
  }
  const y = Number(dataRef.slice(0, 4));
  const desde = fmt(new Date(Date.UTC(y, 0, 1, 3, 0, 0, 0)));
  const ate = fmt(new Date(Date.UTC(y + 1, 0, 1, 3, 0, 0, 0)));
  return { desde, ate };
}

function formatarDataBR(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TIMEZONE_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Periodo = 'dia' | 'mes' | 'ano';

export default function RelatorioFinanceiro() {
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [dataRef, setDataRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { desde, ate } = periodoParaUTC(periodo, dataRef);
    setLoading(true);
    getRelatorioFinanceiro(desde, ate)
      .then((r) => {
        setPedidos(r.pedidos);
        setTotalGeral(r.totalGeral);
      })
      .finally(() => setLoading(false));
  }, [periodo, dataRef]);

  const tituloPeriodo =
    periodo === 'dia'
      ? new Date(dataRef.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : periodo === 'mes'
        ? new Date(dataRef.slice(0, 7) + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : dataRef.slice(0, 4);

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório financeiro</h1>
      <div className="mb-6 flex flex-wrap items-end gap-6">
        <div className="flex gap-2">
          {(['dia', 'mes', 'ano'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPeriodo(t)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                periodo === t ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t === 'dia' ? 'Diário' : t === 'mes' ? 'Mensal' : 'Anual'}
            </button>
          ))}
        </div>
        {periodo === 'dia' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Data</label>
            <input
              type="date"
              value={dataRef.slice(0, 10)}
              onChange={(e) => setDataRef(e.target.value)}
              className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        {periodo === 'mes' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Mês</label>
            <input
              type="month"
              value={dataRef.slice(0, 7)}
              onChange={(e) => setDataRef(e.target.value + '-01')}
              className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        {periodo === 'ano' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Ano</label>
            <input
              type="number"
              min={2020}
              max={2030}
              value={dataRef.slice(0, 4)}
              onChange={(e) => setDataRef(e.target.value + '-01-01')}
              className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
      </div>
      <p className="text-sm text-stone-500 mb-4">
        Período: <strong>{tituloPeriodo}</strong> (horário de Brasília)
      </p>
      {loading ? (
        <p className="text-stone-500">Carregando...</p>
      ) : (
        <>
          <div className="rounded-xl bg-white shadow-sm overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pedido</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Origem</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Mesa</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pagamento</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Subtotal</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Taxa</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Desconto</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="px-4 py-2 text-sm">{formatarDataBR(p.encerrado_em)}</td>
                    <td className="px-4 py-2">{p.numero}</td>
                    <td className="px-4 py-2 text-sm">{p.origem}</td>
                    <td className="px-4 py-2 text-sm">{p.cliente_nome ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{p.mesa ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{p.forma_pagamento ?? '-'}</td>
                    <td className="px-4 py-2 text-right text-sm">R$ {Number(p.subtotal ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-sm">{Number(p.taxa ?? 0) > 0 ? `R$ ${Number(p.taxa).toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-2 text-right text-sm">{Number(p.desconto ?? 0) > 0 ? `R$ ${Number(p.desconto).toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-2 text-right font-medium">R$ {Number(p.total ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-lg font-semibold text-stone-800">Total do período: R$ {totalGeral.toFixed(2)}</div>
        </>
      )}
    </div>
  );
}
