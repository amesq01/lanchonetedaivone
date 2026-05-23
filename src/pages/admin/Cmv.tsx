import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getInsumos,
  saveInsumo,
  deleteInsumo,
  getFichaTecnicaProduto,
  saveFichaTecnicaProduto,
  getRelatorioCmv,
  calcularCustoFicha,
  margemTeoricaProduto,
  getProdutos,
} from '../../lib/api';
import type { RelatorioCmv } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { buildBrPeriodUtcRange, presetAno, presetDia, presetMes, presetSemana } from '../../lib/reportDatePresets';
import { precoVenda, UNIDADES_INSUMO, type UnidadeInsumo } from '../../types/database';
import type { InsumoRow } from '../../lib/api';

type TabId = 'relatorio' | 'insumos' | 'fichas';

function fmtBrl(v: number) {
  return `R$ ${v.toFixed(2)}`;
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function PeriodoFiltros({
  desdeDateTime,
  ateDateTime,
  setDesdeDateTime,
  setAteDateTime,
  onBuscar,
  loading,
  extra,
}: {
  desdeDateTime: string;
  ateDateTime: string;
  setDesdeDateTime: (v: string) => void;
  setAteDateTime: (v: string) => void;
  onBuscar: (desde: string, ate: string) => void;
  loading: boolean;
  extra?: ReactNode;
}) {
  const aplicar = (desde: string, ate: string) => {
    setDesdeDateTime(desde);
    setAteDateTime(ate);
    onBuscar(desde, ate);
  };

  return (
    <div className="mb-6 space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-stone-500">
        Pedidos finalizados por data de encerramento (horário de Brasília). CMV usa a ficha técnica atual de cada produto.
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Diário', fn: presetDia },
          { label: 'Semana', fn: presetSemana },
          { label: 'Mês', fn: presetMes },
          { label: 'Ano', fn: presetAno },
        ].map(({ label, fn }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              const { desde, ate } = fn();
              aplicar(desde, ate);
            }}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-600">De</label>
          <input
            type="datetime-local"
            value={desdeDateTime}
            onChange={(e) => setDesdeDateTime(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600">Até</label>
          <input
            type="datetime-local"
            value={ateDateTime}
            onChange={(e) => setAteDateTime(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={() => onBuscar(desdeDateTime, ateDateTime)}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
        {extra}
      </div>
    </div>
  );
}

function RelatorioTab() {
  const [desdeDateTime, setDesdeDateTime] = useState(() => presetDia().desde);
  const [ateDateTime, setAteDateTime] = useState(() => presetDia().ate);
  const [dados, setDados] = useState<RelatorioCmv | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparar, setComparar] = useState<{ margemPercent: number } | null>(null);
  const [catsAbertas, setCatsAbertas] = useState<Set<string>>(new Set());

  const carregar = (desdeDt: string, ateDt: string) => {
    const range = buildBrPeriodUtcRange(desdeDt, ateDt);
    if (!range) return;
    setLoading(true);
    setComparar(null);
    getRelatorioCmv(range.desde, range.ate)
      .then(setDados)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar(desdeDateTime, ateDateTime);
  }, []);

  const handleComparar = () => {
    const range = buildBrPeriodUtcRange(desdeDateTime, ateDateTime);
    if (!range) return;
    setLoading(true);
    const desdeMs = new Date(range.desde).getTime();
    const ateMs = new Date(range.ate).getTime();
    const ate2Ms = desdeMs - 1000;
    const desde2Ms = ate2Ms - (ateMs - desdeMs);
    const ate2 = new Date(ate2Ms).toISOString();
    const desde2 = new Date(desde2Ms).toISOString();
    Promise.all([getRelatorioCmv(range.desde, range.ate), getRelatorioCmv(desde2, ate2)])
      .then(([atual, ant]) => {
        setDados(atual);
        setComparar({ margemPercent: ant.resumo.margemPercent });
      })
      .finally(() => setLoading(false));
  };

  const handlePdf = () => {
    if (!dados) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Relatório CMV', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    const r = dados.resumo;
    doc.text(`Receita líquida: ${fmtBrl(r.receitaLiquida)} | CMV: ${fmtBrl(r.cmvTotal)} | Margem: ${fmtBrl(r.margemBruta)} (${fmtPct(r.margemPercent)})`, 14, 24);
    autoTable(doc, {
      startY: 32,
      head: [['Produto', 'Qtd', 'Receita', 'CMV', 'Margem']],
      body: dados.porProduto.map((p) => [
        `${p.codigo} ${p.nome}`,
        String(p.quantidadeVendida),
        fmtBrl(p.receita),
        fmtBrl(p.cmv),
        fmtBrl(p.margem),
      ]),
      styles: { fontSize: 8 },
    });
    doc.save(`relatorio-cmv-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const variacaoMargem =
    comparar && comparar.margemPercent !== 0
      ? ((dados?.resumo.margemPercent ?? 0) - comparar.margemPercent) / Math.abs(comparar.margemPercent) * 100
      : null;

  return (
    <div>
      <PeriodoFiltros
        desdeDateTime={desdeDateTime}
        ateDateTime={ateDateTime}
        setDesdeDateTime={setDesdeDateTime}
        setAteDateTime={setAteDateTime}
        onBuscar={carregar}
        loading={loading}
        extra={
          <>
            <button
              type="button"
              onClick={handleComparar}
              disabled={loading}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Comparar período anterior
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={!dados}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Exportar PDF
            </button>
          </>
        }
      />

      {dados && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-stone-500">Receita líquida</p>
              <p className="text-lg font-bold text-stone-800">{fmtBrl(dados.resumo.receitaLiquida)}</p>
              <p className="text-[10px] text-stone-400">{dados.resumo.pedidosCount} pedidos</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-stone-500">CMV</p>
              <p className="text-lg font-bold text-red-700">{fmtBrl(dados.resumo.cmvTotal)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-stone-500">Margem bruta</p>
              <p className="text-lg font-bold text-green-700">{fmtBrl(dados.resumo.margemBruta)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-stone-500">Margem %</p>
              <p className="text-lg font-bold text-stone-800">{fmtPct(dados.resumo.margemPercent)}</p>
              {variacaoMargem != null && (
                <p className={`text-[10px] ${variacaoMargem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {variacaoMargem >= 0 ? '+' : ''}
                  {variacaoMargem.toFixed(1)}% vs período ant.
                </p>
              )}
            </div>
          </div>

          <p className="mb-4 text-xs text-stone-500">
            Receita itens: {fmtBrl(dados.resumo.receitaItens)} · Descontos: {fmtBrl(dados.resumo.descontos)} · Taxas entrega:{' '}
            {fmtBrl(dados.resumo.taxasEntrega)}
          </p>

          {dados.semFicha.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>{dados.semFicha.length} produto(s) vendido(s) sem ficha técnica</strong> — CMV contado como zero:{' '}
              {dados.semFicha.map((p) => p.codigo).join(', ')}
            </div>
          )}

          <div className="mb-6 overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <h2 className="border-b border-stone-200 px-4 py-2 font-semibold text-stone-800">Por produto</h2>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-600">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Receita</th>
                  <th className="px-3 py-2 text-right">Custo un.</th>
                  <th className="px-3 py-2 text-right">CMV</th>
                  <th className="px-3 py-2 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {dados.porProduto.map((p) => (
                  <tr key={p.produto_id} className={`border-t border-stone-100 ${p.semFicha ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-3 py-2">{p.codigo}</td>
                    <td className="px-3 py-2">{p.nome}</td>
                    <td className="px-3 py-2 text-right">{p.quantidadeVendida}</td>
                    <td className="px-3 py-2 text-right">{fmtBrl(p.receita)}</td>
                    <td className="px-3 py-2 text-right">{p.semFicha ? '—' : fmtBrl(p.custoUnitarioFicha)}</td>
                    <td className="px-3 py-2 text-right text-red-700">{fmtBrl(p.cmv)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{fmtBrl(p.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <h2 className="border-b border-stone-200 px-4 py-2 font-semibold text-stone-800">Por origem</h2>
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs text-stone-600">
                  <tr>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2 text-right">Pedidos</th>
                    <th className="px-3 py-2 text-right">Receita*</th>
                    <th className="px-3 py-2 text-right">CMV</th>
                    <th className="px-3 py-2 text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porOrigem.map((o) => (
                    <tr key={o.origem} className="border-t border-stone-100">
                      <td className="px-3 py-2 capitalize">{o.origem}</td>
                      <td className="px-3 py-2 text-right">{o.pedidos}</td>
                      <td className="px-3 py-2 text-right">{fmtBrl(o.receita)}</td>
                      <td className="px-3 py-2 text-right">{fmtBrl(o.cmv)}</td>
                      <td className="px-3 py-2 text-right">{fmtBrl(o.margem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-[10px] text-stone-400">*Receita por itens (antes de desconto/taxa no pedido)</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-stone-800">Por categoria</h2>
            {dados.porCategoria.map((cat) => {
              const aberto = catsAbertas.has(cat.categoria_id);
              return (
                <div key={cat.categoria_id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setCatsAbertas((prev) => {
                        const n = new Set(prev);
                        if (n.has(cat.categoria_id)) n.delete(cat.categoria_id);
                        else n.add(cat.categoria_id);
                        return n;
                      })
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-stone-800 hover:bg-stone-50"
                  >
                    <span className="flex items-center gap-2">
                      {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {cat.categoria_nome}
                    </span>
                    <span className="text-sm text-stone-600">
                      CMV {fmtBrl(cat.cmv)} · Margem {fmtBrl(cat.margem)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function InsumosTab() {
  const queryClient = useQueryClient();
  const { data: lista = [], isLoading } = useQuery({ queryKey: queryKeys.insumos, queryFn: getInsumos });
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<InsumoRow | null | 'novo'>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState<UnidadeInsumo>('un');
  const [custo, setCusto] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [confirmarExcluir, setConfirmarExcluir] = useState<InsumoRow | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((i) => i.nome.toLowerCase().includes(q));
  }, [lista, busca]);

  const abrirEditar = (ins: InsumoRow | 'novo') => {
    setModal(ins);
    if (ins === 'novo') {
      setNome('');
      setUnidade('un');
      setCusto('');
      setAtivo(true);
    } else {
      setNome(ins.nome);
      setUnidade(ins.unidade);
      setCusto(String(ins.custo_unitario));
      setAtivo(ins.ativo);
    }
  };

  const mutationSave = useMutation({
    mutationFn: () =>
      saveInsumo({
        ...(modal !== 'novo' && modal && { id: modal.id }),
        nome,
        unidade,
        custo_unitario: Number(custo) || 0,
        ativo,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.insumos });
      setModal(null);
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao salvar.'),
  });

  const mutationDel = useMutation({
    mutationFn: (id: string) => deleteInsumo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.insumos });
      setConfirmarExcluir(null);
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao excluir.'),
  });

  if (isLoading) return <p className="text-stone-500">Carregando insumos...</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar insumo..."
          className="max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => abrirEditar('novo')}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Novo insumo
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Unidade</th>
              <th className="px-4 py-2 text-right">Custo/un.</th>
              <th className="px-4 py-2">Ativo</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((i) => (
              <tr key={i.id} className="border-t border-stone-100">
                <td className="px-4 py-2">{i.nome}</td>
                <td className="px-4 py-2">{i.unidade}</td>
                <td className="px-4 py-2 text-right">{fmtBrl(Number(i.custo_unitario))}</td>
                <td className="px-4 py-2">{i.ativo ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => abrirEditar(i)} className="text-amber-600 hover:underline mr-2">
                    Editar
                  </button>
                  <button type="button" onClick={() => setConfirmarExcluir(i)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-semibold text-stone-800">{modal === 'novo' ? 'Novo insumo' : 'Editar insumo'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-stone-600">Nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="text-sm text-stone-600">Unidade</label>
                <select value={unidade} onChange={(e) => setUnidade(e.target.value as UnidadeInsumo)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
                  {UNIDADES_INSUMO.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-stone-600">Custo unitário (R$)</label>
                <input type="number" step="0.0001" min="0" value={custo} onChange={(e) => setCusto(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                Ativo
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => mutationSave.mutate()} disabled={mutationSave.isPending || !nome.trim()} className="flex-1 rounded-lg bg-amber-600 py-2 text-white disabled:opacity-50">
                Salvar
              </button>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="mb-4 text-sm text-stone-600">Excluir insumo &quot;{confirmarExcluir.nome}&quot;?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => mutationDel.mutate(confirmarExcluir.id)} className="flex-1 rounded-lg bg-red-600 py-2 text-white">
                Excluir
              </button>
              <button type="button" onClick={() => setConfirmarExcluir(null)} className="rounded-lg border px-4 py-2">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FichasTab() {
  const queryClient = useQueryClient();
  const { data: produtos = [] } = useQuery({ queryKey: queryKeys.produtos(false), queryFn: () => getProdutos(false) });
  const [buscaProd, setBuscaProd] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [linhas, setLinhas] = useState<{ insumo_id: string; quantidade: string }[]>([]);
  const [novoInsumoId, setNovoInsumoId] = useState('');
  const [novaQtd, setNovaQtd] = useState('1');

  const { data: insumos = [] } = useQuery({ queryKey: queryKeys.insumos, queryFn: getInsumos });
  const { data: fichaSalva = [], isFetching } = useQuery({
    queryKey: queryKeys.fichaTecnica(produtoId),
    queryFn: () => getFichaTecnicaProduto(produtoId),
    enabled: Boolean(produtoId),
  });

  const produtoSel = produtos.find((p) => p.id === produtoId);

  useEffect(() => {
    if (!produtoId) {
      setLinhas([]);
      return;
    }
    setLinhas(
      fichaSalva.map((l) => ({
        insumo_id: l.insumo_id,
        quantidade: String(l.quantidade),
      }))
    );
  }, [produtoId, fichaSalva]);

  const produtosFiltrados = useMemo(() => {
    const q = buscaProd.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        (p.codigo ?? '').toLowerCase().includes(q) ||
        (p.nome ?? '').toLowerCase().includes(q) ||
        p.descricao.toLowerCase().includes(q)
    );
  }, [produtos, buscaProd]);

  const linhasDetalhe = useMemo(() => {
    return linhas
      .map((l) => {
        const ins = insumos.find((i) => i.id === l.insumo_id);
        if (!ins) return null;
        const qtd = Number(l.quantidade) || 0;
        const custo = qtd * Number(ins.custo_unitario);
        return { ...l, insumo: ins, qtd, custo };
      })
      .filter(Boolean) as { insumo_id: string; quantidade: string; insumo: InsumoRow; qtd: number; custo: number }[];
  }, [linhas, insumos]);

  const custoFicha = calcularCustoFicha(linhasDetalhe.map((l) => ({ quantidade: l.qtd, custo_unitario: Number(l.insumo.custo_unitario) })));
  const margemTeorica = produtoSel ? margemTeoricaProduto(produtoSel, custoFicha) : null;

  const mutationSave = useMutation({
    mutationFn: () =>
      saveFichaTecnicaProduto(
        produtoId,
        linhas.map((l) => ({ insumo_id: l.insumo_id, quantidade: Number(l.quantidade) || 0 })).filter((l) => l.insumo_id && Number(l.quantidade) > 0)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fichaTecnica(produtoId) });
      alert('Ficha técnica salva.');
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao salvar ficha.'),
  });

  const addLinha = () => {
    if (!novoInsumoId || Number(novaQtd) <= 0) return;
    setLinhas((prev) => [...prev, { insumo_id: novoInsumoId, quantidade: novaQtd }]);
    setNovoInsumoId('');
    setNovaQtd('1');
  };

  return (
    <div>
      <p className="mb-4 text-sm text-stone-600">
        Cadastre quanto de cada insumo entra em <strong>1 unidade vendida</strong> do produto. O custo da ficha é a soma (qtd × custo do insumo).
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={buscaProd}
          onChange={(e) => setBuscaProd(e.target.value)}
          placeholder="Buscar produto..."
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <select
          value={produtoId}
          onChange={(e) => setProdutoId(e.target.value)}
          className="min-w-[240px] rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="">Selecione o produto</option>
          {produtosFiltrados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} – {p.nome || p.descricao}
            </option>
          ))}
        </select>
      </div>

      {produtoId && (
        <>
          {isFetching && <p className="text-sm text-stone-500 mb-2">Carregando ficha...</p>}
          <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
            <span>
              <strong>Custo da ficha:</strong> {fmtBrl(custoFicha)}
            </span>
            {produtoSel && (
              <span>
                <strong>Preço de venda:</strong> {fmtBrl(precoVenda(produtoSel))}
              </span>
            )}
            {margemTeorica != null && (
              <span>
                <strong>Margem teórica:</strong> {fmtPct(margemTeorica)}
              </span>
            )}
          </div>

          <div className="mb-4 overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-600">
                <tr>
                  <th className="px-3 py-2">Insumo</th>
                  <th className="px-3 py-2">Un.</th>
                  <th className="px-3 py-2 text-right">Qtd/produto</th>
                  <th className="px-3 py-2 text-right">Custo linha</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {linhasDetalhe.map((l, idx) => (
                  <tr key={`${l.insumo_id}-${idx}`} className="border-t border-stone-100">
                    <td className="px-3 py-2">{l.insumo.nome}</td>
                    <td className="px-3 py-2">{l.insumo.unidade}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={l.quantidade}
                        onChange={(e) =>
                          setLinhas((prev) => prev.map((row, i) => (i === idx ? { ...row, quantidade: e.target.value } : row)))
                        }
                        className="w-24 rounded border border-stone-300 px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{fmtBrl(l.custo)}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))} className="text-red-600 hover:underline">
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-stone-300 p-3">
            <div>
              <label className="text-xs text-stone-600">Insumo</label>
              <select value={novoInsumoId} onChange={(e) => setNovoInsumoId(e.target.value)} className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {insumos.filter((i) => i.ativo).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome} ({i.unidade}) – {fmtBrl(Number(i.custo_unitario))}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-600">Quantidade</label>
              <input type="number" step="0.0001" min="0" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2" />
            </div>
            <button type="button" onClick={addLinha} className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">
              Adicionar
            </button>
          </div>

          <button
            type="button"
            onClick={() => mutationSave.mutate()}
            disabled={mutationSave.isPending}
            className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {mutationSave.isPending ? 'Salvando...' : 'Salvar ficha técnica'}
          </button>
        </>
      )}
    </div>
  );
}

export default function AdminCmv() {
  const [tab, setTab] = useState<TabId>('relatorio');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'relatorio', label: 'Relatório' },
    { id: 'insumos', label: 'Insumos' },
    { id: 'fichas', label: 'Fichas técnicas' },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-stone-800">CMV — Custo da mercadoria vendida</h1>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'relatorio' && <RelatorioTab />}
      {tab === 'insumos' && <InsumosTab />}
      {tab === 'fichas' && <FichasTab />}
    </div>
  );
}
