import { useEffect, useState } from 'react';
import { getPedidosOnlinePendentes, getPedidosOnlineTodos, getPedidosOnlineEncerradosHoje, acceptPedidoOnline, setImprimidoEntregaPedido, encerrarPedidoOnline, updatePedidoStatus, updatePedidoItens, getProdutos, getMesasFechadasParaTransferencia, getComandaByMesa, openComanda, movePedidosParaOutraComanda } from '../../lib/api';
import type { FraçãoPagamento } from '../../lib/api';
import { printPedido } from '../../lib/printPdf';
import { useAuth } from '../../contexts/AuthContext';
import type { Produto } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';

export default function AdminPedidosOnline() {
  const { profile } = useAuth();
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [encerradosHoje, setEncerradosHoje] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accordionEncerrados, setAccordionEncerrados] = useState(false);
  const [popupCancelar, setPopupCancelar] = useState<{ pedidoId: string; adminOverride?: boolean } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [confirmarEdicaoAvancada, setConfirmarEdicaoAvancada] = useState<any | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [popupEditar, setPopupEditar] = useState<any | null>(null);
  const [carrinhoEdicao, setCarrinhoEdicao] = useState<{ produto: Produto; quantidade: number; observacao: string }[]>([]);
  const [searchEdicao, setSearchEdicao] = useState('');
  const [enviandoEdicao, setEnviandoEdicao] = useState(false);
  const [popupEncerrar, setPopupEncerrar] = useState<{ pedido: any; total: number } | null>(null);
  const [fracoesEncerrar, setFracoesEncerrar] = useState<FraçãoPagamento[]>([]);
  const [novaFraçãoValor, setNovaFraçãoValor] = useState('');
  const [novaFraçãoForma, setNovaFraçãoForma] = useState('');
  const [popupEnviarParaMesa, setPopupEnviarParaMesa] = useState<{ pedido: any } | null>(null);
  const [mesasParaEnviar, setMesasParaEnviar] = useState<{ mesaId: string; mesaNome: string }[]>([]);
  const [mesaIdEnviar, setMesaIdEnviar] = useState('');
  const [novoNomeClienteEnviar, setNovoNomeClienteEnviar] = useState('');
  const [enviandoEnviar, setEnviandoEnviar] = useState(false);

  const formasPagamento = ['dinheiro', 'pix', 'cartão crédito', 'cartão débito'];
  const totalPagoEncerrar = fracoesEncerrar.reduce((s, f) => s + f.valor, 0);
  const totalEncerramento = popupEncerrar?.total ?? 0;
  const podeConfirmarEncerrar = popupEncerrar && fracoesEncerrar.length > 0 && totalPagoEncerrar >= totalEncerramento - 0.01;

  const STATUS_EDITAVEL = ['novo_pedido', 'aguardando_aceite'];
  const pedidoPodeEditarSemConfirmacao = (p: any) => STATUS_EDITAVEL.includes(p.status);
  const abrirEdicao = (p: any) => {
    setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' })));
    setSearchEdicao('');
    setPopupEditar(p);
  };

  async function load() {
    const [pend, all, encerrados] = await Promise.all([
      getPedidosOnlinePendentes(),
      getPedidosOnlineTodos(),
      getPedidosOnlineEncerradosHoje(),
    ]);
    setPendentes(pend);
    setTodos(all.filter((p) => p.status !== 'aguardando_aceite' && !p.encerrado_em));
    setEncerradosHoje(encerrados);
    setLoading(false);
  }

  useEffect(() => {
    load();
    getProdutos(true).then(setProdutos);
  }, []);

  async function handleAceitar(pedidoId: string) {
    await acceptPedidoOnline(pedidoId);
    load();
  }

  function handleImprimirPedido(p: any) {
    const titulo = p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega';
    printPedido(p, titulo);
    if (p.status === 'finalizado' && !p.imprimido_entrega_em) setImprimidoEntregaPedido(p.id).then(load);
  }

  function abrirEncerrar(p: any) {
    const total = totalPedido(p);
    setPopupEncerrar({ pedido: p, total });
    setFracoesEncerrar([]);
    setNovaFraçãoValor(total.toFixed(2));
    setNovaFraçãoForma('');
  }

  const adicionarFraçãoEncerrar = () => {
    const v = Math.max(0, Number(novaFraçãoValor.replace(',', '.')));
    const forma = novaFraçãoForma || formasPagamento[0];
    if (v <= 0) return;
    setFracoesEncerrar((prev) => [...prev, { valor: v, forma_pagamento: forma }]);
    const novoTotalPago = totalPagoEncerrar + v;
    const restante = Math.max(0, totalEncerramento - novoTotalPago);
    setNovaFraçãoValor(restante.toFixed(2));
    setNovaFraçãoForma('');
  };

  const removerFraçãoEncerrar = (index: number) => {
    setFracoesEncerrar((prev) => prev.filter((_, i) => i !== index));
  };

  async function confirmarEncerrar() {
    if (!popupEncerrar || fracoesEncerrar.length === 0) return;
    if (totalPagoEncerrar < totalEncerramento - 0.01) {
      alert(`Valor pago (R$ ${totalPagoEncerrar.toFixed(2)}) é menor que o total do pedido (R$ ${totalEncerramento.toFixed(2)}).`);
      return;
    }
    try {
      await encerrarPedidoOnline(popupEncerrar.pedido.id, fracoesEncerrar);
      setPopupEncerrar(null);
      setFracoesEncerrar([]);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao encerrar.');
    }
  }

  function abrirEnviarParaMesa(p: any) {
    setPopupEnviarParaMesa({ pedido: p });
    setMesaIdEnviar('');
    setNovoNomeClienteEnviar('');
    getMesasFechadasParaTransferencia().then(setMesasParaEnviar);
  }

  async function confirmarEnviarParaMesa() {
    if (!popupEnviarParaMesa || !mesaIdEnviar || !novoNomeClienteEnviar.trim() || !profile?.id) return;
    setEnviandoEnviar(true);
    try {
      const comandaExistente = await getComandaByMesa(mesaIdEnviar);
      if (comandaExistente) {
        alert('Esta mesa já está aberta. Escolha outra mesa livre.');
        return;
      }
      const novaComanda = await openComanda(mesaIdEnviar, profile.id, novoNomeClienteEnviar.trim());
      await movePedidosParaOutraComanda([popupEnviarParaMesa.pedido.id], novaComanda.id);
      setPopupEnviarParaMesa(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao enviar para mesa.');
    } finally {
      setEnviandoEnviar(false);
    }
  }

  async function confirmarCancelarPedido() {
    if (!popupCancelar || !motivoCancelamento.trim()) return;
    try {
      await updatePedidoStatus(popupCancelar.pedidoId, 'cancelado', {
        motivo_cancelamento: motivoCancelamento.trim(),
        cancelado_por: profile?.id,
        adminOverride: popupCancelar.adminOverride,
      });
      setPopupCancelar(null);
      setMotivoCancelamento('');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao cancelar.');
    }
  }

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
    if (!popupEditar || carrinhoEdicao.length === 0) return;
    setEnviandoEdicao(true);
    try {
      const itens = carrinhoEdicao.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        valor_unitario: precoVenda(i.produto),
        observacao: i.observacao || undefined,
      }));
      await updatePedidoItens(popupEditar.id, itens, { adminOverride: true });
      setPopupEditar(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar pedido.');
    } finally {
      setEnviandoEdicao(false);
    }
  };
  const sEdicao = (searchEdicao || '').trim().toLowerCase();
  const filtradosEdicao = sEdicao ? produtos.filter((p) => (p.codigo?.toLowerCase().includes(sEdicao) || (p.nome ?? '').toLowerCase().includes(sEdicao) || (p.descricao ?? '').toLowerCase().includes(sEdicao))) : [];

  const statusLabel: Record<string, string> = {
    novo_pedido: 'Novo (cozinha)',
    em_preparacao: 'Em preparação',
    finalizado: 'Pronto para entrega',
  };

  function pedidoTemItemParaCozinha(p: any) {
    return (p.pedido_itens ?? []).some((i: any) => Boolean(i.produtos?.vai_para_cozinha));
  }

  function totalPedido(p: any) {
    const subtotal = (p.pedido_itens ?? []).reduce((s: number, i: any) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
    const desconto = Number(p.desconto ?? 0);
    const taxa = Number(p.taxa_entrega ?? 0);
    return Math.max(0, subtotal - desconto + taxa);
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="no-print">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Pedidos Online</h1>

      {pendentes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">Aguardando aceite</h2>
          <div className="space-y-4">
            {pendentes.map((p) => (
              <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
                  <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
                  <p className="text-sm text-stone-600">{p.cliente_nome} - {p.cliente_whatsapp}</p>
                  <p className="text-sm text-stone-500">{p.cliente_endereco}</p>
                  {p.ponto_referencia && <p className="text-sm text-stone-500">Ref: {p.ponto_referencia}</p>}
                  <p className="text-sm">Pagamento: {p.forma_pagamento} {p.troco_para ? `- Troco para R$ ${p.troco_para}` : ''}</p>
                  {p.observacoes && <p className="text-sm italic text-stone-500">{p.observacoes}</p>}
                  <ul className="mt-2 text-sm">
                    {(p.pedido_itens ?? []).map((i: any) => (
                      <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao} {i.observacao ? `(${i.observacao})` : ''}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => handleImprimirPedido(p)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-50">
                    Imprimir pedido
                  </button>
                  <button type="button" onClick={() => (pedidoPodeEditarSemConfirmacao(p) ? abrirEdicao(p) : setConfirmarEdicaoAvancada(p))} className="rounded-lg border border-amber-300 px-4 py-2 text-amber-700 hover:bg-amber-50">
                    Editar pedido
                  </button>
                  <button onClick={() => handleAceitar(p.id)} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                    Aceitar pedido
                  </button>
                  <button type="button" onClick={() => abrirEnviarParaMesa(p)} className="rounded-lg border border-stone-400 px-4 py-2 text-stone-700 hover:bg-stone-50">
                    Enviar para mesa
                  </button>
                  <button onClick={() => setPopupCancelar({ pedidoId: p.id, adminOverride: false })} className="rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50">
                    Cancelar pedido
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 mb-4">Pendentes de entrega</h2>
        {todos.length === 0 ? (
          <p className="text-stone-500">Nenhum pedido aceito no momento.</p>
        ) : (
          <div className="space-y-4">
            {todos.map((p) => (
              <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm flex flex-wrap items-stretch justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
                  <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600">{statusLabel[p.status] ?? p.status}</span>
                  <p className="text-sm text-stone-600 mt-1">{p.cliente_nome} - {p.cliente_whatsapp}</p>
                  <p className="text-sm text-stone-500">{p.cliente_endereco}</p>
                  {p.ponto_referencia && <p className="text-sm text-stone-500">Ref: {p.ponto_referencia}</p>}
                  <p className="text-sm">Pagamento: {p.forma_pagamento} {p.troco_para ? `- Troco para R$ ${p.troco_para}` : ''}</p>
                  <ul className="mt-2 text-sm">
                    {(p.pedido_itens ?? []).map((i: any) => (
                      <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao} {i.observacao ? `(${i.observacao})` : ''}</li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
                  <button type="button" onClick={() => handleImprimirPedido(p)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
                    Imprimir pedido
                  </button>
                  <button type="button" onClick={() => (pedidoPodeEditarSemConfirmacao(p) ? abrirEdicao(p) : setConfirmarEdicaoAvancada(p))} className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">
                    Editar pedido
                  </button>
                  {p.status === 'finalizado' && (
                    <>
                      {!p.imprimido_entrega_em ? null : (
                        <button onClick={() => abrirEncerrar(p)} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
                          Encerrar pedido
                        </button>
                      )}
                    </>
                  )}
                  {pedidoTemItemParaCozinha(p) && (p.status === 'novo_pedido' || p.status === 'em_preparacao') && (
                    <span className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                      Aguardando finalização na cozinha
                    </span>
                  )}
                  <button type="button" onClick={() => abrirEnviarParaMesa(p)} className="rounded-lg border border-stone-400 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
                    Enviar para mesa
                  </button>
                  <button onClick={() => setPopupCancelar({ pedidoId: p.id, adminOverride: !pedidoPodeEditarSemConfirmacao(p) })} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                    Cancelar pedido
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {popupEnviarParaMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Enviar pedido #{popupEnviarParaMesa.pedido.numero} para mesa</h3>
            <p className="text-sm text-stone-500 mb-3">Escolha uma mesa que não esteja aberta. Será aberta uma comanda e o pedido será transferido.</p>
            <label className="block text-sm font-medium text-stone-600 mb-1">Mesa de destino (livre)</label>
            <select value={mesaIdEnviar} onChange={(e) => setMesaIdEnviar(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-2">
              <option value="">Selecione...</option>
              {mesasParaEnviar.map((m) => (
                <option key={m.mesaId} value={m.mesaId}>{m.mesaNome}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-stone-600 mb-1 mt-2">Nome do cliente (mesa de destino)</label>
            <input type="text" value={novoNomeClienteEnviar} onChange={(e) => setNovoNomeClienteEnviar(e.target.value)} placeholder="Ex: João" className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4" />
            {mesasParaEnviar.length === 0 && <p className="text-sm text-amber-600 mb-2">Nenhuma mesa livre no momento.</p>}
            <div className="flex gap-2">
              <button onClick={confirmarEnviarParaMesa} disabled={!mesaIdEnviar || !novoNomeClienteEnviar.trim() || enviandoEnviar || mesasParaEnviar.length === 0} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                {enviandoEnviar ? 'Enviando...' : 'Confirmar'}
              </button>
              <button onClick={() => setPopupEnviarParaMesa(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {popupEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-stone-800 mb-3">Editar pedido #{popupEditar.numero} (online)</h3>
            <p className="text-sm text-stone-500 mb-3">Altere os itens e salve. Como admin, você pode editar em qualquer status.</p>
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

      {confirmarEdicaoAvancada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Editar pedido já em andamento</h3>
            <p className="text-sm text-stone-600 mb-4">Este pedido já foi iniciado ou finalizado na cozinha. Deseja mesmo editar? As alterações podem impactar o fluxo da cozinha.</p>
            <div className="flex gap-2">
              <button onClick={() => { abrirEdicao(confirmarEdicaoAvancada); setConfirmarEdicaoAvancada(null); }} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700">Sim, editar</button>
              <button onClick={() => setConfirmarEdicaoAvancada(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Não</button>
            </div>
          </div>
        </div>
      )}

      {popupEncerrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Encerrar pedido #{popupEncerrar.pedido.numero}</h3>
            <p className="text-sm text-stone-500 mb-3">Adicione as frações de pagamento até completar o total do pedido.</p>
            <p className="text-sm font-medium text-amber-700 mb-3">Total do pedido: R$ {totalEncerramento.toFixed(2)}</p>
            <div className="flex gap-2 mb-2">
              <input type="text" inputMode="decimal" value={novaFraçãoValor} onChange={(e) => setNovaFraçãoValor(e.target.value)} placeholder="Valor (ex: 25,50)" className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              <select value={novaFraçãoForma} onChange={(e) => setNovaFraçãoForma(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm min-w-[140px]">
                {formasPagamento.map((f) => (<option key={f} value={f}>{f}</option>))}
              </select>
              <button type="button" onClick={adicionarFraçãoEncerrar} disabled={!novaFraçãoValor.trim() || Number(novaFraçãoValor.replace(',', '.')) <= 0} className="rounded-lg bg-stone-700 px-3 py-2 text-white text-sm hover:bg-stone-800 disabled:opacity-50">Adicionar</button>
            </div>
            {fracoesEncerrar.length > 0 && (
              <ul className="mb-3 rounded-lg border border-stone-200 divide-y divide-stone-100 max-h-32 overflow-y-auto">
                {fracoesEncerrar.map((f, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{f.forma_pagamento}: R$ {f.valor.toFixed(2)}</span>
                    <button type="button" onClick={() => removerFraçãoEncerrar(i)} className="text-red-600 hover:underline">Remover</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm font-medium text-stone-700 mb-3">Total pago: R$ {totalPagoEncerrar.toFixed(2)} {totalPagoEncerrar >= totalEncerramento - 0.01 ? '✓' : `(falta R$ ${(totalEncerramento - totalPagoEncerrar).toFixed(2)})`}</p>
            <div className="flex gap-2">
              <button onClick={confirmarEncerrar} disabled={!podeConfirmarEncerrar} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">Confirmar encerramento</button>
              <button onClick={() => { setPopupEncerrar(null); setFracoesEncerrar([]); setNovaFraçãoValor(''); setNovaFraçãoForma(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {popupCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Cancelar pedido</h3>
            {popupCancelar.adminOverride && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">Este pedido já foi iniciado ou finalizado na cozinha. Ao cancelar, o estoque será devolvido.</p>
            )}
            <p className="text-sm text-stone-600 mb-2">Informe o motivo do cancelamento (obrigatório para relatório):</p>
            <textarea value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4 min-h-[80px]" placeholder="Ex: Cliente desistiu" required />
            <div className="flex gap-2">
              <button onClick={confirmarCancelarPedido} disabled={!motivoCancelamento.trim()} className="flex-1 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-50">Confirmar cancelamento</button>
              <button onClick={() => { setPopupCancelar(null); setMotivoCancelamento(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Voltar</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <button onClick={() => setAccordionEncerrados(!accordionEncerrados)} className="flex w-full items-center justify-between rounded-lg bg-stone-100 px-4 py-2 text-left font-medium text-stone-700">
          Pedidos encerrados hoje
          <span>{accordionEncerrados ? '−' : '+'}</span>
        </button>
        {accordionEncerrados && (
          <div className="mt-2 space-y-2">
            {encerradosHoje.length === 0 ? (
              <p className="text-sm text-stone-500 py-2">Nenhum pedido encerrado hoje.</p>
            ) : (
              encerradosHoje.map((p) => (
                <div key={p.id} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm flex flex-wrap justify-between gap-2 items-center">
                  <span>#{p.numero} - {p.cliente_nome} - {p.forma_pagamento ?? '-'} - {p.encerrado_em ? new Date(p.encerrado_em).toLocaleString('pt-BR') : ''}</span>
                  <span className="font-medium text-amber-700">R$ {totalPedido(p).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
