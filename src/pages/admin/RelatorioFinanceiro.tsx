import { useEffect, useState } from 'react';
import { getRelatorioFinanceiro } from '../../lib/api';

type Periodo = 'dia' | 'mes' | 'ano';

export default function RelatorioFinanceiro() {
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [dataRef, setDataRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let desde: string;
    let ate: string;
    const d = new Date(dataRef + 'T12:00:00');
    if (periodo === 'dia') {
      desde = d.toISOString().slice(0, 19).replace('T', ' ');
      ate = new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    } else if (periodo === 'mes') {
      d.setDate(1);
      desde = d.toISOString().slice(0, 19).replace('T', ' ');
      d.setMonth(d.getMonth() + 1);
      ate = d.toISOString().slice(0, 19).replace('T', ' ');
    } else {
      d.setMonth(0, 1);
      desde = d.toISOString().slice(0, 19).replace('T', ' ');
      d.setFullYear(d.getFullYear() + 1);
      ate = d.toISOString().slice(0, 19).replace('T', ' ');
    }
    setLoading(true);
    getRelatorioFinanceiro(desde, ate)
      .then((r) => {
        setPedidos(r.pedidos);
        setTotalGeral(r.totalGeral);
      })
      .finally(() => setLoading(false));
  }, [periodo, dataRef]);

  const labelData = periodo === 'dia' ? 'Data' : periodo === 'mes' ? 'Mês (ano-mês)' : 'Ano';

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório financeiro</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-stone-600">Período</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="mt-1 rounded-lg border border-stone-300 px-3 py-2">
            <option value="dia">Diário</option>
            <option value="mes">Mensal</option>
            <option value="ano">Anual</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600">{labelData}</label>
          <input
            type={periodo === 'ano' ? 'number' : periodo === 'mes' ? 'month' : 'date'}
            value={periodo === 'ano' ? dataRef.slice(0, 4) : periodo === 'mes' ? dataRef.slice(0, 7) : dataRef.slice(0, 10)}
            onChange={(e) => {
              const v = e.target.value;
              if (periodo === 'ano') setDataRef(v + '-01-01');
              else if (periodo === 'mes') setDataRef(v + '-01');
              else setDataRef(v);
            }}
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
      </div>
      {loading ? (
        <p className="text-stone-500">Carregando...</p>
      ) : (
        <>
          <div className="rounded-xl bg-white shadow-sm overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Origem</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pagamento</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Desconto</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="px-4 py-2 text-sm">{p.encerrado_em ? new Date(p.encerrado_em).toLocaleString('pt-BR') : '-'}</td>
                    <td className="px-4 py-2">{p.numero}</td>
                    <td className="px-4 py-2 text-sm">{p.origem}</td>
                    <td className="px-4 py-2 text-sm">{p.cliente_nome ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{p.forma_pagamento ?? '-'}</td>
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
