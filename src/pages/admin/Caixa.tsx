import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getCaixaCategorias,
  saveCaixaCategoria,
  deleteCaixaCategoria,
  getCaixaSaidas,
  saveCaixaSaida,
  deleteCaixaSaida,
  getRelatorioFluxoCaixa,
} from '../../lib/api';
import type { RelatorioFluxoCaixa, CaixaCategoriaRow, CaixaSaidaRow } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { buildBrPeriodUtcRange, presetAno, presetDia, presetMes, presetSemana } from '../../lib/reportDatePresets';

type TabId = 'fluxo' | 'saidas' | 'categorias';

function fmtBrl(v: number) {
  return `R$ ${v.toFixed(2)}`;
}

function fmtDataBr(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function PeriodoFiltros({
  desdeDateTime,
  ateDateTime,
  setDesdeDateTime,
  setAteDateTime,
  onBuscar,
  loading,
  nota,
  extra,
}: {
  desdeDateTime: string;
  ateDateTime: string;
  setDesdeDateTime: (v: string) => void;
  setAteDateTime: (v: string) => void;
  onBuscar: (desde: string, ate: string) => void;
  loading: boolean;
  nota?: string;
  extra?: ReactNode;
}) {
  const aplicar = (desde: string, ate: string) => {
    setDesdeDateTime(desde);
    setAteDateTime(ate);
    onBuscar(desde, ate);
  };

  return (
    <div className="mb-6 space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      {nota && <p className="text-xs text-stone-500">{nota}</p>}
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

function FluxoTab() {
  const [desdeDateTime, setDesdeDateTime] = useState(() => presetDia().desde);
  const [ateDateTime, setAteDateTime] = useState(() => presetDia().ate);
  const [dados, setDados] = useState<RelatorioFluxoCaixa | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = (desdeDt: string, ateDt: string) => {
    const range = buildBrPeriodUtcRange(desdeDt, ateDt);
    if (!range) return;
    setLoading(true);
    getRelatorioFluxoCaixa(range.desde, range.ate)
      .then(setDados)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar(desdeDateTime, ateDateTime);
  }, []);

  const r = dados?.resumo;

  return (
    <div>
      <PeriodoFiltros
        desdeDateTime={desdeDateTime}
        ateDateTime={ateDateTime}
        setDesdeDateTime={setDesdeDateTime}
        setAteDateTime={setAteDateTime}
        onBuscar={carregar}
        loading={loading}
        nota="Entradas: pedidos finalizados por encerramento (Brasília). No campo Até, use 23:59 para incluir o dia inteiro (se o horário ficar 00:00, o sistema considera até o fim desse dia). Saídas: data da despesa/compra."
      />
      {r && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-800">Entradas (vendas)</p>
              <p className="text-2xl font-bold text-emerald-900">{fmtBrl(r.entradasVendas)}</p>
              <p className="text-xs text-emerald-700">{r.pedidosCount} pedido(s)</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium text-red-800">Saídas (compras/despesas)</p>
              <p className="text-2xl font-bold text-red-900">{fmtBrl(r.saidasTotal)}</p>
            </div>
            <div
              className={`rounded-xl border p-4 sm:col-span-2 ${
                r.saldo >= 0 ? 'border-stone-200 bg-white' : 'border-amber-300 bg-amber-50'
              }`}
            >
              <p className="text-xs font-medium text-stone-600">Saldo do período (entradas − saídas)</p>
              <p className={`text-2xl font-bold ${r.saldo >= 0 ? 'text-stone-900' : 'text-amber-900'}`}>
                {fmtBrl(r.saldo)}
              </p>
            </div>
          </div>

          {dados.porCategoria.length > 0 && (
            <div className="mb-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <h2 className="border-b border-stone-100 px-4 py-3 font-semibold text-stone-800">Saídas por categoria</h2>
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-stone-600">
                  <tr>
                    <th className="px-4 py-2">Categoria</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porCategoria.map((c) => (
                    <tr key={c.categoria_id} className="border-t border-stone-100">
                      <td className="px-4 py-2">{c.categoria_nome}</td>
                      <td className="px-4 py-2 text-right font-medium text-red-700">{fmtBrl(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados.saidas.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <h2 className="border-b border-stone-100 px-4 py-3 font-semibold text-stone-800">Lançamentos de saída</h2>
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-stone-600">
                  <tr>
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">Categoria</th>
                    <th className="px-4 py-2">Descrição</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.saidas.map((s) => (
                    <tr key={s.id} className="border-t border-stone-100">
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDataBr(s.data)}</td>
                      <td className="px-4 py-2">{s.categoria_nome}</td>
                      <td className="px-4 py-2 text-stone-600">{s.descricao || '—'}</td>
                      <td className="px-4 py-2 text-right">{fmtBrl(s.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados.saidas.length === 0 && (
            <p className="text-sm text-stone-500">Nenhuma saída lançada neste período. Use a aba Saídas para registrar compras e despesas.</p>
          )}
        </>
      )}
      {!loading && !dados && <p className="text-stone-500">Selecione o período e busque.</p>}
    </div>
  );
}

function SaidasTab() {
  const queryClient = useQueryClient();
  const [desdeDateTime, setDesdeDateTime] = useState(() => presetDia().desde);
  const [ateDateTime, setAteDateTime] = useState(() => presetDia().ate);
  const [utcRange, setUtcRange] = useState<{ desde: string; ate: string } | null>(null);
  const [modal, setModal] = useState<CaixaSaidaRow | null | 'novo'>(null);
  const [erro, setErro] = useState('');

  const { data: categorias = [] } = useQuery({
    queryKey: queryKeys.caixaCategorias,
    queryFn: getCaixaCategorias,
  });

  const catsAtivas = useMemo(() => categorias.filter((c) => c.ativo), [categorias]);

  const { data: saidas = [], isLoading, refetch } = useQuery({
    queryKey: utcRange ? queryKeys.caixaSaidas(utcRange.desde, utcRange.ate) : ['caixa-saidas', 'idle'],
    queryFn: () => getCaixaSaidas(utcRange!.desde, utcRange!.ate),
    enabled: !!utcRange,
  });

  const buscar = (desdeDt: string, ateDt: string) => {
    const range = buildBrPeriodUtcRange(desdeDt, ateDt);
    if (!range) return;
    setUtcRange(range);
  };

  useEffect(() => {
    buscar(desdeDateTime, ateDateTime);
  }, []);

  const saveMut = useMutation({
    mutationFn: saveCaixaSaida,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caixaCategorias });
      if (utcRange) {
        queryClient.invalidateQueries({ queryKey: queryKeys.caixaSaidas(utcRange.desde, utcRange.ate) });
        queryClient.invalidateQueries({ queryKey: queryKeys.relatorioFluxoCaixa(utcRange.desde, utcRange.ate) });
      }
      refetch();
      setModal(null);
      setErro('');
    },
    onError: (e: Error) => setErro(e.message),
  });

  const delMut = useMutation({
    mutationFn: deleteCaixaSaida,
    onSuccess: () => {
      if (utcRange) {
        queryClient.invalidateQueries({ queryKey: queryKeys.caixaSaidas(utcRange.desde, utcRange.ate) });
        queryClient.invalidateQueries({ queryKey: queryKeys.relatorioFluxoCaixa(utcRange.desde, utcRange.ate) });
      }
      refetch();
    },
  });

  return (
    <div>
      <PeriodoFiltros
        desdeDateTime={desdeDateTime}
        ateDateTime={ateDateTime}
        setDesdeDateTime={setDesdeDateTime}
        setAteDateTime={setAteDateTime}
        onBuscar={buscar}
        loading={isLoading}
        extra={
          <button
            type="button"
            onClick={() => {
              setErro('');
              setModal('novo');
            }}
            disabled={catsAtivas.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Nova saída
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Categoria</th>
              <th className="px-4 py-2">Descrição</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {saidas.map((s) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="px-4 py-2">{fmtDataBr(s.data)}</td>
                <td className="px-4 py-2">{s.categoria_nome}</td>
                <td className="px-4 py-2 text-stone-600">{s.descricao || '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{fmtBrl(s.valor)}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setErro('');
                        setModal(s);
                      }}
                      className="rounded p-1 text-stone-500 hover:bg-stone-100"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Excluir este lançamento?')) delMut.mutate(s.id);
                      }}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && saidas.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-stone-500">Nenhum lançamento no período.</p>
        )}
      </div>

      {modal && (
        <SaidaModal
          categorias={catsAtivas}
          inicial={modal === 'novo' ? null : modal}
          erro={erro}
          saving={saveMut.isPending}
          onClose={() => {
            setModal(null);
            setErro('');
          }}
          onSave={(payload) => saveMut.mutate(payload)}
        />
      )}
    </div>
  );
}

function SaidaModal({
  categorias,
  inicial,
  erro,
  saving,
  onClose,
  onSave,
}: {
  categorias: CaixaCategoriaRow[];
  inicial: CaixaSaidaRow | null;
  erro: string;
  saving: boolean;
  onClose: () => void;
  onSave: (p: { id?: string; categoria_id: string; data: string; valor: number; descricao?: string | null }) => void;
}) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [categoriaId, setCategoriaId] = useState(inicial?.categoria_id ?? categorias[0]?.id ?? '');
  const [data, setData] = useState(inicial?.data?.slice(0, 10) ?? hoje);
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-stone-800">{inicial ? 'Editar saída' : 'Nova saída'}</h3>
        {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600">Categoria</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Data da despesa</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Valor (R$)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Descrição (opcional)</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: nota do açougue, conta de luz..."
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !categoriaId || !data || !valor}
            onClick={() =>
              onSave({
                id: inicial?.id,
                categoria_id: categoriaId,
                data,
                valor: Number(valor),
                descricao: descricao || null,
              })
            }
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriasTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<CaixaCategoriaRow | null | 'novo'>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: queryKeys.caixaCategorias,
    queryFn: getCaixaCategorias,
  });

  const saveMut = useMutation({
    mutationFn: saveCaixaCategoria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caixaCategorias });
      setModal(null);
      setNome('');
      setErro('');
    },
    onError: (e: Error) => setErro(e.message),
  });

  const delMut = useMutation({
    mutationFn: deleteCaixaCategoria,
    onError: (e: Error) => alert(e.message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.caixaCategorias }),
  });

  return (
    <div>
      <p className="mb-4 text-sm text-stone-600">
        Categorias para classificar saídas (compras, salários, contas fixas). Você pode adicionar novas além das padrão.
      </p>
      <button
        type="button"
        onClick={() => {
          setNome('');
          setErro('');
          setModal('novo');
        }}
        className="mb-4 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        <Plus className="h-4 w-4" /> Nova categoria
      </button>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Ativa</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-t border-stone-100">
                <td className="px-4 py-2 font-medium">{c.nome}</td>
                <td className="px-4 py-2">{c.ativo ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setNome(c.nome);
                        setErro('');
                        setModal(c);
                      }}
                      className="rounded p-1 text-stone-500 hover:bg-stone-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir categoria "${c.nome}"?`)) delMut.mutate(c.id);
                      }}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && categorias.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-stone-500">Nenhuma categoria. Rode a migration no Supabase.</p>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{modal === 'novo' ? 'Nova categoria' : 'Editar categoria'}</h3>
            {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
            <label className="block text-sm font-medium text-stone-600">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
            {modal !== 'novo' && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={modal.ativo}
                  onChange={(e) => setModal({ ...modal, ativo: e.target.checked })}
                />
                Categoria ativa (aparece ao lançar saída)
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                disabled={saveMut.isPending || !nome.trim()}
                onClick={() =>
                  saveMut.mutate({
                    id: modal === 'novo' ? undefined : modal.id,
                    nome,
                    ativo: modal === 'novo' ? true : modal.ativo,
                  })
                }
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Caixa() {
  const [tab, setTab] = useState<TabId>('fluxo');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'fluxo', label: 'Fluxo' },
    { id: 'saidas', label: 'Saídas' },
    { id: 'categorias', label: 'Categorias' },
  ];

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Fluxo de caixa</h1>
      <p className="mb-6 text-sm text-stone-600">
        Compare o que entrou com vendas e o que saiu com compras e despesas cadastradas manualmente.
      </p>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-amber-600 text-amber-700' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fluxo' && <FluxoTab />}
      {tab === 'saidas' && <SaidasTab />}
      {tab === 'categorias' && <CategoriasTab />}
    </div>
  );
}
