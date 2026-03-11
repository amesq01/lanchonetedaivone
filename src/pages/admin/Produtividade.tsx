import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getProdutividade } from '../../lib/api';
import type { ProdutividadePorCategoria } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';

/** Converte "YYYY-MM-DDTHH:mm" (Brasília) para UTC "YYYY-MM-DD HH:mm:ss". */
function datetimeLocalBrToUTC(dt: string): string {
  if (!dt || dt.length < 16) return '';
  const [datePart, timePart] = dt.split('T');
  const [y, m, d] = datePart.slice(0, 10).split('-').map(Number);
  const [hh = 0, mm = 0] = (timePart || '00:00').split(':').map(Number);
  const brAsUTC = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  const utc = new Date(brAsUTC.getTime() + 3 * 60 * 60 * 1000);
  return utc.toISOString().slice(0, 19).replace('T', ' ');
}

function getHojeBr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
}

/** Preseta desde/até para Dia (hoje 00:00 e 23:59 em BR). */
function presetDia(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  return { desde: hoje + 'T00:00', ate: hoje + 'T23:59' };
}

/** Preseta desde/até para o mês atual em BR. */
function presetMes(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  const [y, m] = hoje.slice(0, 7).split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { desde: `${hoje.slice(0, 7)}-01T00:00`, ate: `${lastStr}T23:59` };
}

/** Preseta desde/até para o ano atual em BR. */
function presetAno(): { desde: string; ate: string } {
  const y = new Date().getFullYear();
  return { desde: `${y}-01-01T00:00`, ate: `${y}-12-31T23:59` };
}

export default function AdminProdutividade() {
  const [desdeDateTime, setDesdeDateTime] = useState(() => presetDia().desde);
  const [ateDateTime, setAteDateTime] = useState(() => presetDia().ate);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [porCategoria, setPorCategoria] = useState<ProdutividadePorCategoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [accordionAbertos, setAccordionAbertos] = useState<Set<string>>(new Set());
  const [totalPedidos2, setTotalPedidos2] = useState<number | null>(null);
  const [compararLoading, setCompararLoading] = useState(false);

  const categoriasVisiveis = useMemo(
    () => porCategoria.filter((cat) => cat.categoriaNome.toUpperCase() !== 'PROMOÇÕES'),
    [porCategoria]
  );

  const toggleAccordion = (categoriaId: string) => {
    setAccordionAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(categoriaId)) next.delete(categoriaId);
      else next.add(categoriaId);
      return next;
    });
  };

  useEffect(() => {
    setTotalPedidos2(null);
  }, [desdeDateTime, ateDateTime]);

  const handleComparar = () => {
    const desde = datetimeLocalBrToUTC(desdeDateTime);
    const ate = datetimeLocalBrToUTC(ateDateTime);
    if (!desde || !ate) return;
    setLoading(true);
    setCompararLoading(true);
    const desdeMs = new Date(desde.replace(' ', 'T') + 'Z').getTime();
    const ateMs = new Date(ate.replace(' ', 'T') + 'Z').getTime();
    const duracaoMs = ateMs - desdeMs;
    const ate2Ms = desdeMs - 1000;
    const desde2Ms = ate2Ms - duracaoMs;
    const desde2 = new Date(desde2Ms).toISOString().slice(0, 19).replace('T', ' ');
    const ate2 = new Date(ate2Ms).toISOString().slice(0, 19).replace('T', ' ');
    Promise.all([
      getProdutividade(desde, ate),
      getProdutividade(desde2, ate2),
    ])
      .then(([r1, r2]) => {
        setTotalPedidos(r1.totalPedidos);
        setPorCategoria(r1.porCategoria);
        setTotalPedidos2(r2.totalPedidos);
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

  const tituloPeriodoAnterior = totalPedidos2 != null ? 'Intervalo anterior (mesma duração)' : '—';

  const variacaoPedidos =
    totalPedidos2 != null && totalPedidos2 > 0
      ? ((totalPedidos - totalPedidos2) / totalPedidos2) * 100
      : null;

  return (
    <div className="min-w-0">
      <h1 className="mb-4 text-xl sm:text-2xl font-bold text-stone-800">Produtividade</h1>

      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetDia();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetMes();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetAno();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Ano
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

      {loading && <p className="text-stone-500">Carregando...</p>}

      {!loading && (
        <>
          {totalPedidos2 != null && (
            <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-amber-800 mb-3">Comparação com período anterior</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-stone-500">Período selecionado</p>
                  <p className="font-semibold text-stone-800">{tituloPeriodo}</p>
                  <p className="text-lg font-bold text-stone-800">{totalPedidos} pedidos</p>
                </div>
                <div>
                  <p className="text-stone-500">Intervalo anterior (mesma duração)</p>
                  <p className="font-semibold text-stone-800">{tituloPeriodoAnterior}</p>
                  <p className="text-lg font-bold text-stone-800">{totalPedidos2} pedidos</p>
                </div>
                <div>
                  <p className="text-stone-500">Variação</p>
                  {variacaoPedidos != null ? (
                    <p className={`text-lg font-bold ${variacaoPedidos >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {variacaoPedidos >= 0 ? '+' : ''}{variacaoPedidos.toFixed(1)}%
                    </p>
                  ) : (
                    <p className="text-stone-500">—</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm border border-stone-200">
            <h2 className="text-sm font-medium text-stone-600 mb-1">Total de pedidos realizados</h2>
            <p className="text-2xl font-bold text-stone-800">{totalPedidos}</p>
            <p className="text-xs text-stone-500 mt-1">Período: {tituloPeriodo}. Mesmo critério do Rel. Financeiro: pedidos finalizados com encerramento no período.</p>
          </div>

          <h2 className="text-lg font-semibold text-stone-800 mb-3">Produtos mais vendidos por categoria</h2>
          <div className="space-y-2">
            {categoriasVisiveis.map((cat) => {
              const aberto = accordionAbertos.has(cat.categoriaId);
              return (
                <div
                  key={cat.categoriaId}
                  className="rounded-xl bg-white shadow-sm border border-stone-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(cat.categoriaId)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 font-medium text-stone-800 text-left hover:bg-stone-100 transition-colors"
                  >
                    {aberto ? (
                      <ChevronDown className="w-4 h-4 shrink-0 text-stone-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 text-stone-500" />
                    )}
                    {cat.categoriaNome}
                    {cat.produtos.length > 0 && (
                      <span className="ml-1 text-sm font-normal text-stone-500">
                        ({cat.produtos.length} {cat.produtos.length === 1 ? 'produto' : 'produtos'})
                      </span>
                    )}
                  </button>
                  {aberto && (
                    <>
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
