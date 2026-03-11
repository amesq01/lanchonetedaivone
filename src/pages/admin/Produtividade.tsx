import { useEffect, useState } from 'react';
import { getProdutividade } from '../../lib/api';
import type { ProdutividadePorCategoria } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';

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

type Periodo = 'dia' | 'mes' | 'ano';

export default function AdminProdutividade() {
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [dataRef, setDataRef] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR })
  );
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [porCategoria, setPorCategoria] = useState<ProdutividadePorCategoria[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { desde, ate } = periodoParaUTC(periodo, dataRef);
    setLoading(true);
    getProdutividade(desde, ate)
      .then((r) => {
        setTotalPedidos(r.totalPedidos);
        setPorCategoria(r.porCategoria);
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
    <div className="min-w-0">
      <h1 className="mb-4 text-xl sm:text-2xl font-bold text-stone-800">Produtividade</h1>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600">Período</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="dia">Dia</option>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600">
            {periodo === 'dia' ? 'Data' : periodo === 'mes' ? 'Mês' : 'Ano'}
          </label>
          {periodo === 'mes' ? (
            <input
              type="month"
              value={dataRef.slice(0, 7)}
              onChange={(e) => setDataRef(e.target.value ? e.target.value + '-01' : dataRef)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          ) : (
            <input
              type={periodo === 'ano' ? 'number' : 'date'}
              min={periodo === 'ano' ? 2020 : undefined}
              max={periodo === 'ano' ? 2030 : undefined}
              value={periodo === 'ano' ? dataRef.slice(0, 4) : dataRef.slice(0, 10)}
              onChange={(e) => {
                const v = e.target.value;
                if (periodo === 'ano') setDataRef(v.length === 4 ? v + '-01-01' : dataRef);
                else setDataRef(v || dataRef);
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          )}
        </div>
      </div>

      {loading && <p className="text-stone-500">Carregando...</p>}

      {!loading && (
        <>
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm border border-stone-200">
            <h2 className="text-sm font-medium text-stone-600 mb-1">Total de pedidos realizados</h2>
            <p className="text-2xl font-bold text-stone-800">{totalPedidos}</p>
            <p className="text-xs text-stone-500 mt-1">Período: {tituloPeriodo}. Mesmo critério do Rel. Financeiro: pedidos finalizados com encerramento no período.</p>
          </div>

          <h2 className="text-lg font-semibold text-stone-800 mb-3">Produtos mais vendidos por categoria</h2>
          <div className="space-y-3">
            {porCategoria.map((cat) => (
              <div
                key={cat.categoriaId}
                className="rounded-xl bg-white shadow-sm border border-stone-200 overflow-hidden"
              >
                <h3 className="px-4 py-3 bg-stone-50 border-b border-stone-200 font-medium text-stone-800">
                  {cat.categoriaNome}
                  {cat.produtos.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-stone-500">
                      ({cat.produtos.length} {cat.produtos.length === 1 ? 'produto' : 'produtos'})
                    </span>
                  )}
                </h3>
                {cat.produtos.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-stone-500">Nenhuma venda no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[200px]">
                      <thead className="border-b border-stone-200 bg-stone-50/80">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Produto</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-stone-600">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.produtos.map((prod) => (
                          <tr key={prod.produtoId} className="border-b border-stone-100 last:border-0">
                            <td className="px-4 py-2 text-sm text-stone-800">{prod.nome}</td>
                            <td className="px-4 py-2 text-sm text-stone-600 text-right">{prod.quantidade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
