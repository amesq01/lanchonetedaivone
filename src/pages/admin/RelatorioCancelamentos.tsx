import { useEffect, useState } from 'react';
import { getRelatorioCancelamentos } from '../../lib/api';

/** Brasília = UTC-3: 00:00 BRT = 03:00 UTC, 23:59:59 BRT = próximo dia 02:59:59 UTC */
function rangeBrasilia(tipo: 'dia' | 'mes' | 'ano', value: string): { desde: string; ate: string } {
  if (tipo === 'dia') {
    const [y, m, d] = value.split('-').map(Number);
    const desde = new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0)).toISOString();
    const ate = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999)).toISOString();
    return { desde, ate };
  }
  if (tipo === 'mes') {
    const [y, m] = value.split('-').map(Number);
    const desde = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0, 0)).toISOString();
    const ultimoDia = new Date(y, m, 0).getDate();
    const ate = new Date(Date.UTC(y, m - 1, ultimoDia + 1, 2, 59, 59, 999)).toISOString();
    return { desde, ate };
  }
  const y = Number(value);
  const desde = new Date(Date.UTC(y, 0, 1, 3, 0, 0, 0)).toISOString();
  const ate = new Date(Date.UTC(y, 11, 31 + 1, 2, 59, 59, 999)).toISOString();
  return { desde, ate };
}

const hojeBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const diaAtual = hojeBR;
const mesAtual = hojeBR.slice(0, 7);
const anoAtual = hojeBR.slice(0, 4);

export default function RelatorioCancelamentos() {
  const [tipo, setTipo] = useState<'dia' | 'mes' | 'ano'>('dia');
  const [dataRef, setDataRef] = useState(diaAtual);
  const [mesRef, setMesRef] = useState(mesAtual);
  const [anoRef, setAnoRef] = useState(anoAtual);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const valor = tipo === 'dia' ? dataRef : tipo === 'mes' ? mesRef : anoRef;

  useEffect(() => {
    const { desde, ate } = rangeBrasilia(tipo, valor);
    setLoading(true);
    getRelatorioCancelamentos(desde, ate)
      .then((r) => setItens(r.itens))
      .finally(() => setLoading(false));
  }, [tipo, valor]);

  const tituloPeriodo =
    tipo === 'dia'
      ? new Date(dataRef + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : tipo === 'mes'
        ? new Date(mesRef + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : anoRef;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório de cancelamentos</h1>
      <div className="mb-6 flex flex-wrap items-end gap-6">
        <div className="flex gap-2">
          {(['dia', 'mes', 'ano'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === 'mes') {
                  if (tipo === 'dia') setMesRef(dataRef.slice(0, 7));
                  else if (tipo === 'ano') setMesRef(anoRef + '-01');
                } else if (t === 'ano') {
                  if (tipo === 'dia') setAnoRef(dataRef.slice(0, 4));
                  else if (tipo === 'mes') setAnoRef(mesRef.slice(0, 4));
                }
                setTipo(t);
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                tipo === t ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t === 'dia' ? 'Diário' : t === 'mes' ? 'Mensal' : 'Anual'}
            </button>
          ))}
        </div>
        {tipo === 'dia' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Data</label>
            <input
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        {tipo === 'mes' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Mês</label>
            <input
              type="month"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
              className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        {tipo === 'ano' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Ano</label>
            <input
              type="number"
              min={2020}
              max={2030}
              value={anoRef}
              onChange={(e) => setAnoRef(e.target.value)}
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
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Data/hora</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pedido #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Origem</th>
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
