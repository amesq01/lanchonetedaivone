import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getPedidosViagemAbertos, getPedidosViagemHoje, getPedidoStatus, updatePedidoStatus, updatePedidoItens, getProdutos } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Produto } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';

const statusLabel: Record<string, string> = {
  novo_pedido: 'Novo pedido',
  em_preparacao: 'Em preparação',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export default function AtendenteViagem() {
  const { profile } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidosHoje, setPedidosHoje] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [popupExcluir, setPopupExcluir] = useState<{ pedidoId: string } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [acordaoAberto, setAcordaoAberto] = useState<string | null>(null);
  const [acordaoPedidosAberto, setAcordaoPedidosAberto] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [popupEditar, setPopupEditar] = useState<any | null>(null);
  const [carrinhoEdicao, setCarrinhoEdicao] = useState<{ produto: Produto; quantidade: number; observacao: string }[]>([]);
  const [searchEdicao, setSearchEdicao] = useState('');
  const [enviandoEdicao, setEnviandoEdicao] = useState(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    load();
    getProdutos(true).then(setProdutos);
  }, []);

  async function load() {
    const [data, hoje] = await Promise.all([getPedidosViagemAbertos(), getPedidosViagemHoje()]);
    setPedidos(data.filter((p) => p.status === 'novo_pedido'));
    setPedidosHoje(hoje);
    setLoading(false);
  }

  const confirmarExcluir = async () => {
    if (!popupExcluir) return;
    const atual = await getPedidoStatus(popupExcluir.pedidoId);
    if (!atual) {
      setToast('Pedido não encontrado.');
      setPopupExcluir(null);
      setMotivoCancelamento('');
      return;
    }
    if (atual.status !== 'novo_pedido') {
      setToast(`Não é possível excluir. O pedido já está: ${statusLabel[atual.status] ?? atual.status}. A cozinha já pode ter iniciado o preparo.`);
      setPopupExcluir(null);
      setMotivoCancelamento('');
      return;
    }
    await updatePedidoStatus(popupExcluir.pedidoId, 'cancelado', {
      motivo_cancelamento: motivoCancelamento.trim(),
      cancelado_por: profile?.id,
    });
    setPopupExcluir(null);
    setMotivoCancelamento('');
    load();
  };

  const addItemEdicao = (produto: Produto, qtd = 1, obs = '') => {
    setCarrinhoEdicao((c) => {
      const exist = c.find((i) => i.produto.id === produto.id && i.observacao === obs);
      if (exist) return c.map((i) => i.produto.id === produto.id && i.observacao === obs ? { ...i, quantidade: i.quantidade + qtd } : i);
      return [...c, { produto, quantidade: qtd, observacao: obs }];
    });
  };
  const updateQtdEdicao = (index: number, delta: number) => {
    setCarrinhoEdicao((c) => {
      const novo = c.map((item, i) => (i === index ? { ...item, quantidade: Math.max(0, item.quantidade + delta) } : item));
      return novo.filter((i) => i.quantidade > 0);
    });
  };
  const setObsEdicao = (index: number, value: string) => {
    setCarrinhoEdicao((c) => c.map((item, i) => (i === index ? { ...item, observacao: value } : item)));
  };
  const salvarEdicao = async () => {
    if (!popupEditar || carrinhoEdicao.length === 0) {
      setToast('Adicione pelo menos um item.');
      return;
    }
    setEnviandoEdicao(true);
    try {
      const itens = carrinhoEdicao.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        valor_unitario: precoVenda(i.produto),
        observacao: i.observacao || undefined,
      }));
      await updatePedidoItens(popupEditar.id, itens);
      setPopupEditar(null);
      load();
      setToast('Pedido atualizado.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Erro ao atualizar pedido.');
    } finally {
      setEnviandoEdicao(false);
    }
  };
  const sEdicao = (searchEdicao || '').trim().toLowerCase();
  const filtradosEdicao = sEdicao ? produtos.filter((p) => (p.codigo?.toLowerCase().includes(sEdicao) || (p.nome ?? '').toLowerCase().includes(sEdicao) || (p.descricao ?? '').toLowerCase().includes(sEdicao))) : [];

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  const pedidosHojeMeus = pedidosHoje.filter((p) => (p.comandas as any)?.atendente_id === profile?.id);

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg text-amber-800">
          {toast}
        </div>
      )}
      <h1 className="text-xl font-bold text-stone-800 mb-4">Mesa VIAGEM</h1>
      <p className="text-stone-600 mb-4">Pedidos para viagem. Nunca bloqueada.</p>
      <Link to="/pdv/viagem/novo" className="mb-6 block w-full rounded-xl bg-amber-600 py-3 text-center font-medium text-white hover:bg-amber-700">
        NOVO PEDIDO
      </Link>

      {/* Accordion: Pedidos de hoje (viagem) - somente deste atendente */}
      <div className="mb-6 rounded-xl border border-stone-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setAcordaoPedidosAberto((a) => !a)}
          className="flex w-full items-center justify-between p-3 text-left font-medium text-stone-800 hover:bg-stone-50"
        >
          <span>Meus pedidos de hoje (viagem)</span>
          <span className="text-sm font-normal text-stone-500 mr-2">{pedidosHojeMeus.length} pedido(s)</span>
          {acordaoPedidosAberto ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {acordaoPedidosAberto && (
          <div className="border-t border-stone-100">
            {pedidosHojeMeus.length === 0 ? (
              <p className="p-3 text-sm text-stone-500">Nenhum pedido de viagem hoje.</p>
            ) : (
              pedidosHojeMeus.map((p) => {
                const expandido = acordaoAberto === p.id;
                return (
                  <div key={p.id} className="border-t border-stone-100 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => setAcordaoAberto(expandido ? null : p.id)}
                      className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-stone-50"
                    >
                      <span className="font-medium text-stone-800">
                      {(p.comandas as any)?.profiles?.nome
                        ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`
                        : `Pedido #${p.numero}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`}
                    </span>
                      <span className="text-stone-500 text-xs mr-2">{p.cliente_nome ?? '-'}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600">{statusLabel[p.status] ?? p.status}</span>
                      {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandido && (
                      <div className="px-3 pb-3 pt-0 text-sm text-stone-600 border-t border-stone-100 bg-stone-50/50">
                        <ul className="list-disc list-inside">
                          {(p.pedido_itens ?? []).map((i: any) => (
                            <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}{i.observacao ? ` (${i.observacao})` : ''}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-stone-500">
                          {p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : ''}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm border border-stone-200 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-stone-800">
              {(p.comandas as any)?.profiles?.nome
                ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`
                : `Pedido #${p.numero}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`}
            </div>
              <div className="text-sm text-stone-600">{p.cliente_nome}</div>
              <ul className="text-sm text-stone-500 mt-1">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setPopupEditar(p); setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' }))); setSearchEdicao(''); }}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setPopupExcluir({ pedidoId: p.id })}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Excluir pedido
              </button>
            </div>
          </div>
        ))}
      </div>

      {popupEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-stone-800 mb-3">Editar pedido #{popupEditar.numero}</h3>
            <p className="text-sm text-stone-500 mb-3">Altere os itens e salve. Só é possível editar antes do preparo.</p>
            <input type="text" value={searchEdicao} onChange={(e) => setSearchEdicao(e.target.value)} placeholder="Buscar por nome ou código..." className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-2" />
            {sEdicao && filtradosEdicao.length > 0 && (
              <ul className="mb-3 max-h-[50vh] overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100 shadow-sm">
                {filtradosEdicao.slice(0, 30).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { addItemEdicao(p); setSearchEdicao(''); }} className="flex w-full min-h-[3.25rem] items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-stone-100 overflow-hidden flex items-center justify-center">
                        {imagensProduto(p)[0] ? <img src={imagensProduto(p)[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-sm font-medium text-stone-500">#{p.codigo}</span>
                        <span className="text-stone-800 truncate text-sm">{p.nome || p.descricao}</span>
                      </div>
                      <div className="flex-shrink-0 text-right text-[10px]">
                        {p.em_promocao && p.valor_promocional != null && Number(p.valor_promocional) > 0 ? (
                          <>
                            <span className="text-stone-500 block">De: <span className="line-through text-stone-400">R$ {Number(p.valor).toFixed(2)}</span></span>
                            <span className="text-amber-600 font-medium">Por: R$ {Number(p.valor_promocional).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-amber-600 font-medium text-sm">R$ {precoVenda(p).toFixed(2)}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-xl border border-stone-200 overflow-hidden mb-4">
              <div className="p-3 border-b border-stone-100 font-medium text-stone-700">Itens do pedido</div>
              <ul className="divide-y divide-stone-100">
                {carrinhoEdicao.map((item, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 p-3">
                    <div className="w-12 h-12 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {imagensProduto(item.produto)[0] ? <img src={imagensProduto(item.produto)[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800">{item.produto.codigo} – {item.produto.nome || item.produto.descricao}</div>
                      <input type="text" value={item.observacao} onChange={(e) => setObsEdicao(i, e.target.value)} placeholder="Observação (ex: sem cebola)" className="mt-1 w-full text-sm rounded border border-stone-200 px-2 py-1" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQtdEdicao(i, -1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">−</button>
                      <span className="w-8 text-center font-medium">{item.quantidade}</span>
                      <button type="button" onClick={() => updateQtdEdicao(i, 1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">+</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button onClick={salvarEdicao} disabled={enviandoEdicao || carrinhoEdicao.length === 0} className="flex-1 rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50">Salvar alterações</button>
              <button onClick={() => setPopupEditar(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {popupExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Excluir pedido</h3>
            <p className="text-sm text-stone-600 mb-2">Só é possível excluir se a cozinha ainda não tiver iniciado o preparo.</p>
            <p className="text-sm text-stone-600 mb-2">Informe o motivo do cancelamento (obrigatório para relatório):</p>
            <textarea
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Cliente desistiu"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mb-4 min-h-[80px]"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarExcluir}
                disabled={!motivoCancelamento.trim()}
                className="flex-1 rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => { setPopupExcluir(null); setMotivoCancelamento(''); }}
                className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
