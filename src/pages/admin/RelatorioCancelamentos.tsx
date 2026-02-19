import { useEffect, useState } from 'react';
import { getRelatorioCancelamentos } from '../../lib/api';

export default function RelatorioCancelamentos() {
  const [dataRef, setDataRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = new Date(dataRef + 'T12:00:00');
    const desde = d.toISOString().slice(0, 19).replace('T', ' ');
    const ate = new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    setLoading(true);
    getRelatorioCancelamentos(desde, ate)
      .then((r) => setItens(r.itens))
      .finally(() => setLoading(false));
  }, [dataRef]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório de cancelamentos</h1>
      <div className="mb-6">
        <label className="block text-sm font-medium text-stone-600">Data (diário)</label>
        <input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} className="mt-1 rounded-lg border border-stone-300 px-3 py-2" />
      </div>
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
          {itens.length === 0 && !loading && <p className="p-4 text-stone-500 text-center">Nenhum cancelamento nesta data.</p>}
        </div>
      )}
    </div>
  );
}
