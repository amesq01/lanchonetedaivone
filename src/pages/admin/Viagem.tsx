import { useEffect, useState } from 'react';
import { getPedidosViagemAbertos, getTotalComanda, getTotalAPagarComanda, closeComanda, getCuponsAtivos, applyDescontoComanda, clearDescontoComanda, getProdutos, updatePedidoItens, updatePedidoStatus, getMesasParaTransferencia, openComanda, movePedidosParaOutraComanda, createPedidoViagem } from '../../lib/api';
import type { FraçãoPagamento } from '../../lib/api';
import { printContaViagem, printPedido, printPedidosUnificados } from '../../lib/printPdf';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Cupom } from '../../types/database';
import type { Produto } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';
import { formatarTelefone } from '../../lib/mascaraTelefone';

export default function AdminViagem() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accordionFinalizados, setAccordionFinalizados] = useState(false);
  const [popupPagamento, setPopupPagamento] = useState<{ pedidoId: string; comandaId: string } | null>(null);
  const [totalContaEncerramento, setTotalContaEncerramento] = useState(0);
  const [fracoesPagamento, setFracoesPagamento] = useState<FraçãoPagamento[]>([]);
  const [novaFraçãoValor, setNovaFraçãoValor] = useState('');
  const [novaFraçãoForma, setNovaFraçãoForma] = useState('');
  const [popupImprimir, setPopupImprimir] = useState<any | null>(null);
  const [contaItensPedido, setContaItensPedido] = useState<{ itens: { codigo: string; descricao: string; quantidade: number; valor: number }[]; total: number } | null>(null);
  const [cupomDesconto, setCupomDesconto] = useState('');
  const [descontoManual, setDescontoManual] = useState('');
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [popupEditar, setPopupEditar] = useState<any | null>(null);
  const [carrinhoEdicao, setCarrinhoEdicao] = useState<{ produto: Produto; quantidade: number; observacao: string }[]>([]);
  const [searchEdicao, setSearchEdicao] = useState('');
  const [enviandoEdicao, setEnviandoEdicao] = useState(false);
  const [popupCancelar, setPopupCancelar] = useState<{ pedidoId: string; adminOverride?: boolean } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [confirmarEdicaoAvancada, setConfirmarEdicaoAvancada] = useState<any | null>(null);
  const [pedidosSelecionadosViagem, setPedidosSelecionadosViagem] = useState<Set<string>>(new Set());
  const [popupMoverSelecionadosViagem, setPopupMoverSelecionadosViagem] = useState(false);
  const [mesasDestino, setMesasDestino] = useState<{ mesaId: string; mesaNome: string; comandaId: string | null }[]>([]);
  const [mesaIdDestinoViagem, setMesaIdDestinoViagem] = useState('');
  const [novoNomeClienteDestinoViagem, setNovoNomeClienteDestinoViagem] = useState('');
  const [enviandoTransferenciaViagem, setEnviandoTransferenciaViagem] = useState(false);
  /** Novo pedido viagem (admin) */
  type ItemCarrinho = { produto: Produto; quantidade: number; observacao: string };
  const [nomeClienteNovo, setNomeClienteNovo] = useState('');
  const [telefoneNovo, setTelefoneNovo] = useState('');
  const [searchNovo, setSearchNovo] = useState('');
  const [carrinhoNovo, setCarrinhoNovo] = useState<ItemCarrinho[]>([]);
  const [enviandoNovo, setEnviandoNovo] = useState(false);

  const { profile } = useAuth();
  const STATUS_EDITAVEL = ['novo_pedido', 'aguardando_aceite'];

  useEffect(() => {
    load();
    getProdutos(true).then(setProdutos);
  }, []);

  async function load() {
    const abertos = await getPedidosViagemAbertos();
    setPedidos(abertos);
    setLoading(false);
  }

  useEffect(() => {
    getCuponsAtivos().then(setCupons);
  }, []);

  async function getTotalPedido(pedidoId: string) {
    const { data: ped } = await supabase.from('pedidos').select('comanda_id').eq('id', pedidoId).single();
    const p = ped as { comanda_id: string } | null;
    if (!p?.comanda_id) return { itens: [], total: 0 };
    return getTotalComanda(p.comanda_id);
  }

  useEffect(() => {
    if (popupImprimir) getTotalPedido(popupImprimir.id).then(setContaItensPedido);
    else setContaItensPedido(null);
  }, [popupImprimir?.id]);

  const handleAbrirImprimir = (pedido: any) => setPopupImprimir(pedido);

  const handleImprimirConta = async () => {
    if (!popupImprimir) return;
    const cupomSelecionado = cupomDesconto ? cupons.find((c) => c.id === cupomDesconto) : null;
    let contaParaPrint = contaItensPedido ?? await getTotalPedido(popupImprimir.id);
    const subtotal = contaParaPrint.total;
    let valorCupom = cupomSelecionado ? (subtotal * Number(cupomSelecionado.porcentagem)) / 100 : 0;
    if (cupomSelecionado?.valor_maximo != null) valorCupom = Math.min(valorCupom, Number(cupomSelecionado.valor_maximo));
    const valorManual = Math.max(0, Number(descontoManual) || 0);
    const valorDesconto = Math.min(subtotal, valorCupom + valorManual);
    if (valorDesconto > 0) {
      await applyDescontoComanda(popupImprimir.comanda_id, cupomSelecionado?.id ?? null, valorDesconto);
      contaParaPrint = await getTotalPedido(popupImprimir.id);
      setContaItensPedido(contaParaPrint);
    } else {
      await clearDescontoComanda(popupImprimir.comanda_id);
    }
    setPopupImprimir(null);
    await printContaViagem({
      pedidoNumero: popupImprimir.numero,
      clienteNome: popupImprimir.cliente_nome || (popupImprimir.comandas as any)?.nome_cliente || '-',
      itens: contaParaPrint.itens,
      subtotal,
      valorCupom,
      valorManual,
      total: subtotal - valorDesconto,
      cupomCodigo: cupomSelecionado?.codigo,
    });
  };

  const handleEncerrarPedido = (pedido: any) => {
    setPopupPagamento({ pedidoId: pedido.id, comandaId: pedido.comanda_id });
    setFracoesPagamento([]);
    setNovaFraçãoForma('');
    getTotalAPagarComanda(pedido.comanda_id).then((total) => {
      setTotalContaEncerramento(total);
      setNovaFraçãoValor(total.toFixed(2));
    });
  };

  const formas = ['dinheiro', 'pix', 'cartão de crédito', 'cartão de débito'];
  const totalPagoViagem = fracoesPagamento.reduce((s, f) => s + f.valor, 0);
  const contaZeradaViagem = totalContaEncerramento < 0.01;
  const podeConfirmarEncerramentoViagem = popupPagamento && (contaZeradaViagem || (fracoesPagamento.length > 0 && totalPagoViagem >= totalContaEncerramento - 0.01));

  const adicionarFraçãoViagem = () => {
    const v = Math.max(0, Number(novaFraçãoValor.replace(',', '.')));
    const forma = novaFraçãoForma || formas[0];
    if (v <= 0) return;
    setFracoesPagamento((prev) => [...prev, { valor: v, forma_pagamento: forma }]);
    const novoTotalPago = totalPagoViagem + v;
    const restante = Math.max(0, totalContaEncerramento - novoTotalPago);
    setNovaFraçãoValor(restante.toFixed(2));
    setNovaFraçãoForma('');
  };

  const removerFraçãoViagem = (index: number) => {
    setFracoesPagamento((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmarEncerramento = async () => {
    if (!popupPagamento) return;
    if (totalContaEncerramento >= 0.01 && fracoesPagamento.length === 0) return;
    if (totalContaEncerramento >= 0.01 && totalPagoViagem < totalContaEncerramento - 0.01) {
      alert(`Valor pago (R$ ${totalPagoViagem.toFixed(2)}) é menor que o total da conta (R$ ${totalContaEncerramento.toFixed(2)}).`);
      return;
    }
    try {
      await closeComanda(popupPagamento.comandaId, contaZeradaViagem ? [] : fracoesPagamento);
      setPopupPagamento(null);
      setFracoesPagamento([]);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao encerrar.');
    }
  };

  const addItemNovo = (produto: Produto, qtd = 1, obs = '') => {
    const exist = carrinhoNovo.find((i) => i.produto.id === produto.id && i.observacao === obs);
    if (exist) setCarrinhoNovo((c) => c.map((i) => i.produto.id === produto.id && i.observacao === obs ? { ...i, quantidade: i.quantidade + qtd } : i));
    else setCarrinhoNovo((c) => [...c, { produto, quantidade: qtd, observacao: obs }]);
    setSearchNovo('');
  };
  const updateQtdNovo = (index: number, delta: number) => {
    setCarrinhoNovo((c) => {
      const novo = c.map((item, i) => (i === index ? { ...item, quantidade: Math.max(0, item.quantidade + delta) } : item));
      return novo.filter((i) => i.quantidade > 0);
    });
  };
  const setObsNovo = (index: number, value: string) => {
    setCarrinhoNovo((c) => c.map((item, i) => (i === index ? { ...item, observacao: value } : item)));
  };
  const finalizarNovoPedidoViagem = async () => {
    if (!nomeClienteNovo.trim() || carrinhoNovo.length === 0 || !profile?.id) {
      alert('Informe o nome do cliente e adicione ao menos um item.');
      return;
    }
    setEnviandoNovo(true);
    try {
      const itens = carrinhoNovo.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        valor_unitario: precoVenda(i.produto),
        observacao: i.observacao || undefined,
      }));
      await createPedidoViagem(nomeClienteNovo.trim(), profile.id, itens, { lancadoPeloAdmin: true, telefone: telefoneNovo.trim() || undefined });
      setNomeClienteNovo('');
      setTelefoneNovo('');
      setCarrinhoNovo([]);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao lançar pedido.');
    } finally {
      setEnviandoNovo(false);
    }
  };
  const sNovo = (searchNovo || '').trim().toLowerCase();
  const filtradosNovo = sNovo ? produtos.filter((p) => (p.nome?.toLowerCase().includes(sNovo)) || (p.codigo === searchNovo.trim())) : [];

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

  const abrirEdicao = (p: any) => {
    setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' })));
    setSearchEdicao('');
    setPopupEditar(p);
  };
  const pedidoPodeEditarSemConfirmacao = (p: any) => STATUS_EDITAVEL.includes(p.status);

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
  const sEdicao = (searchEdicao || '').trim().toLowerCase();
  const filtradosEdicao = sEdicao ? produtos.filter((p) => (p.codigo?.toLowerCase().includes(sEdicao) || (p.nome ?? '').toLowerCase().includes(sEdicao) || (p.descricao ?? '').toLowerCase().includes(sEdicao))) : [];

  const comandaAberta = (p: any) => (Array.isArray(p.comandas) ? p.comandas[0]?.aberta : p.comandas?.aberta) !== false;
  const emPreparacao = pedidos.filter((p) => p.status !== 'finalizado');
  const prontosEncerrar = pedidos.filter((p) => p.status === 'finalizado' && comandaAberta(p));
  const finalizadosEncerrados = pedidos.filter((p) => p.status === 'finalizado' && !comandaAberta(p));

  function totalPedido(p: any) {
    const subtotal = (p.pedido_itens ?? []).reduce((s: number, i: any) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
    const desconto = Number(p.desconto ?? 0);
    const taxa = Number(p.taxa_entrega ?? 0);
    return Math.max(0, subtotal - desconto + taxa);
  }

  const cupomSelecionado = cupomDesconto ? cupons.find((c) => c.id === cupomDesconto) : null;
  const subtotalPrint = contaItensPedido?.total ?? 0;
  let valorCupomPrint = cupomSelecionado ? (subtotalPrint * Number(cupomSelecionado.porcentagem)) / 100 : 0;
  if (cupomSelecionado?.valor_maximo != null) valorCupomPrint = Math.min(valorCupomPrint, Number(cupomSelecionado.valor_maximo));
  const valorManualPrint = Math.max(0, Number(descontoManual) || 0);
  const valorDescontoPrint = Math.min(subtotalPrint, valorCupomPrint + valorManualPrint);

  const togglePedidoSelecionadoViagem = (pedidoId: string) => {
    setPedidosSelecionadosViagem((prev) => {
      const next = new Set(prev);
      if (next.has(pedidoId)) next.delete(pedidoId);
      else next.add(pedidoId);
      return next;
    });
  };

  const abrirMoverSelecionadosViagem = () => {
    if (pedidosSelecionadosViagem.size === 0) return;
    const primeiroSelecionado = pedidos.find((p) => pedidosSelecionadosViagem.has(p.id));
    const nomeInicial = primeiroSelecionado?.cliente_nome || (primeiroSelecionado?.comandas as any)?.nome_cliente || '';
    setMesaIdDestinoViagem('');
    setNovoNomeClienteDestinoViagem(nomeInicial);
    setPopupMoverSelecionadosViagem(true);
    getMesasParaTransferencia()
      .then(setMesasDestino)
      .catch((e) => {
        alert(e instanceof Error ? e.message : 'Erro ao carregar mesas.');
        setMesasDestino([]);
      });
  };

  const confirmarMoverSelecionadosViagem = async () => {
    if (!mesaIdDestinoViagem || pedidosSelecionadosViagem.size === 0 || !profile?.id) return;
    const mesaDest = mesasDestino.find((m) => m.mesaId === mesaIdDestinoViagem);
    const comandaIdDestino = mesaDest?.comandaId;
    if (!comandaIdDestino && !novoNomeClienteDestinoViagem.trim()) {
      alert('Informe o nome do cliente para abrir a mesa de destino (quando a mesa estiver livre).');
      return;
    }
    const ids = Array.from(pedidosSelecionadosViagem);
    const pedidosMovidos = pedidos.filter((p) => ids.includes(p.id));
    const comandasMovidas = [...new Set(pedidosMovidos.map((p) => p.comanda_id).filter(Boolean))] as string[];
    const fecharComandasOrigemIds = comandasMovidas.filter((comandaId) => {
      const totalNaComanda = pedidos.filter((p) => p.comanda_id === comandaId).length;
      const movendo = pedidosMovidos.filter((p) => p.comanda_id === comandaId).length;
      return totalNaComanda === movendo;
    });
    setEnviandoTransferenciaViagem(true);
    try {
      let comandaDestinoId: string;
      if (comandaIdDestino) {
        comandaDestinoId = comandaIdDestino;
      } else {
        const novaComanda = await openComanda(mesaIdDestinoViagem, profile.id, novoNomeClienteDestinoViagem.trim());
        comandaDestinoId = novaComanda.id;
      }
      await movePedidosParaOutraComanda(ids, comandaDestinoId, { fecharComandasOrigemIds });
      setPopupMoverSelecionadosViagem(false);
      setPedidosSelecionadosViagem(new Set());
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao transferir.');
    } finally {
      setEnviandoTransferenciaViagem(false);
    }
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="no-print min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-800">Mesa VIAGEM</h1>
          <p className="text-stone-600 text-sm sm:text-base">Pedidos para viagem. Marque os pedidos e use &quot;Mover selecionados&quot; para enviar a uma mesa local (aberta ou livre).</p>
        </div>
        {pedidosSelecionadosViagem.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { const sel = pedidos.filter((p) => pedidosSelecionadosViagem.has(p.id)); printPedidosUnificados(sel, 'Viagem'); }} className="rounded-lg border border-stone-400 px-4 py-2 text-stone-700 hover:bg-stone-50">
              Imprimir selecionados ({pedidosSelecionadosViagem.size})
            </button>
            <button onClick={abrirMoverSelecionadosViagem} className="rounded-lg border border-amber-400 px-4 py-2 text-amber-700 hover:bg-amber-50 text-sm sm:text-base">
              Mover selecionados para mesa local ({pedidosSelecionadosViagem.size})
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
        <h3 className="font-semibold text-stone-800 mb-3 text-base sm:text-lg">Novo pedido viagem</h3>
        <p className="text-sm text-stone-500 mb-3">Informe o cliente, busque os produtos e finalize. O pedido será exibido como &quot;lançada pelo admin&quot;.</p>
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-stone-600 mb-1">Nome do cliente</label>
            <input type="text" value={nomeClienteNovo} onChange={(e) => setNomeClienteNovo(e.target.value)} placeholder="Ex: Maria" className="w-full rounded-lg border border-stone-300 px-3 py-2" />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-stone-600 mb-1">Telefone (opcional)</label>
            <input type="tel" value={telefoneNovo} onChange={(e) => setTelefoneNovo(formatarTelefone(e.target.value))} placeholder="(11) 99999-9999" className="w-full rounded-lg border border-stone-300 px-3 py-2" />
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <label className="block text-sm font-medium text-stone-600 mb-1">Buscar produto</label>
            <input type="text" value={searchNovo} onChange={(e) => setSearchNovo(e.target.value)} placeholder="Nome ou código..." className="w-full rounded-lg border border-stone-300 px-3 py-2" />
            {sNovo && filtradosNovo.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-[50vh] overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg divide-y divide-stone-100">
                {filtradosNovo.slice(0, 30).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => addItemNovo(p)} className="flex w-full min-h-[3.25rem] items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-stone-100 overflow-hidden flex items-center justify-center">
                        {imagensProduto(p)[0] ? <img src={imagensProduto(p)[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-stone-500">#{p.codigo}</span>
                        <span className="ml-2 text-stone-800 truncate text-sm">{p.nome || p.descricao}</span>
                      </div>
                      <div className="flex-shrink-0 text-amber-600 font-medium text-sm">R$ {precoVenda(p).toFixed(2)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {carrinhoNovo.length > 0 && (
          <div className="rounded-lg border border-stone-200 overflow-hidden mb-3">
            <div className="p-2 border-b border-stone-100 font-medium text-stone-700 text-sm">Itens do pedido</div>
            <ul className="divide-y divide-stone-100">
              {carrinhoNovo.map((item, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 p-2">
                  <div className="w-10 h-10 rounded bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {imagensProduto(item.produto)[0] ? <img src={imagensProduto(item.produto)[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-800 text-sm">{item.produto.codigo} – {item.produto.nome || item.produto.descricao}</div>
                    <input type="text" value={item.observacao} onChange={(e) => setObsNovo(i, e.target.value)} placeholder="Observação" className="mt-0.5 w-full text-sm rounded border border-stone-200 px-2 py-1" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQtdNovo(i, -1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">−</button>
                    <span className="w-8 text-center font-medium text-sm">{item.quantidade}</span>
                    <button type="button" onClick={() => updateQtdNovo(i, 1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">+</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-2 border-t border-stone-100">
              <button type="button" onClick={finalizarNovoPedidoViagem} disabled={enviandoNovo} className="w-full rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {enviandoNovo ? 'Enviando...' : 'Finalizar pedido viagem'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {emPreparacao.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-3 sm:p-4 shadow-sm flex flex-wrap items-stretch justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <input type="checkbox" checked={pedidosSelecionadosViagem.has(p.id)} onChange={() => togglePedidoSelecionadoViagem(p.id)} className="mt-1 rounded border-stone-300" />
              <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800">
              {(p.comandas as any)?.profiles?.nome
                ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`
                : `Pedido #${p.numero}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`}
            </div>
              <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
              <span className="text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              <ul className="mt-2 text-sm text-stone-600">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
              </div>
            </div>
            <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
              <button type="button" onClick={() => printPedido(p, 'Viagem')} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 mb-2">
                Imprimir pedido
              </button>
              <button type="button" onClick={() => pedidoPodeEditarSemConfirmacao(p) ? abrirEdicao(p) : setConfirmarEdicaoAvancada(p)} className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 mb-2">
                Editar pedido
              </button>
              <button type="button" onClick={() => setPopupCancelar({ pedidoId: p.id, adminOverride: !pedidoPodeEditarSemConfirmacao(p) })} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 mb-2">
                Cancelar pedido
              </button>
              <span className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                Aguardando finalização na cozinha
              </span>
            </div>
          </div>
        ))}
        {prontosEncerrar.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-3 sm:p-4 shadow-sm border-l-4 border-amber-500 flex flex-wrap items-stretch justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <input type="checkbox" checked={pedidosSelecionadosViagem.has(p.id)} onChange={() => togglePedidoSelecionadoViagem(p.id)} className="mt-1 rounded border-stone-300" />
              <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800">
              {(p.comandas as any)?.profiles?.nome
                ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`
                : `Pedido #${p.numero}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`}
            </div>
              <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
              <span className="text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              <ul className="mt-2 text-sm text-stone-600">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
              </div>
            </div>
            <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
              <button type="button" onClick={() => printPedido(p, 'Viagem')} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
                Imprimir pedido
              </button>
              <button type="button" onClick={() => pedidoPodeEditarSemConfirmacao(p) ? abrirEdicao(p) : setConfirmarEdicaoAvancada(p)} className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">
                Editar pedido
              </button>
              <button type="button" onClick={() => setPopupCancelar({ pedidoId: p.id, adminOverride: !pedidoPodeEditarSemConfirmacao(p) })} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                Cancelar pedido
              </button>
              <button onClick={() => handleAbrirImprimir(p)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
                Imprimir conta
              </button>
              <button onClick={() => handleEncerrarPedido(p)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700">
                Encerrar pedido
              </button>
            </div>
          </div>
        ))}
      </div>

      {popupEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-stone-800 mb-3">Editar pedido #{popupEditar.numero}</h3>
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

      <div className="mt-8">
        <button onClick={() => setAccordionFinalizados(!accordionFinalizados)} className="flex w-full items-center justify-between rounded-lg bg-stone-100 px-4 py-2 text-left font-medium text-stone-700">
          Pedidos finalizados
          <span>{accordionFinalizados ? '−' : '+'}</span>
        </button>
        {accordionFinalizados && (
          <div className="mt-2 space-y-2">
            {finalizadosEncerrados.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm flex flex-wrap justify-between items-center gap-2">
                <span>#{p.numero}{(p.comandas as any)?.profiles?.nome ? ` – ${(p.comandas as any).profiles.nome}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}` : (p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''} - {(p.comandas as any)?.nome_cliente ?? p.cliente_nome} - {p.forma_pagamento ?? '-'}</span>
                <span className="font-medium text-amber-700">R$ {totalPedido(p).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {popupImprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="font-semibold text-stone-800 mb-4">Imprimir conta - Pedido #{popupImprimir.numero}{(popupImprimir.comandas as any)?.profiles?.nome ? ` – ${(popupImprimir.comandas as any).profiles.nome}${(popupImprimir as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}` : (popupImprimir as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}</h3>
            <label className="block text-sm font-medium text-stone-600 mb-1">Cupom</label>
            <select
              value={cupomDesconto}
              onChange={(e) => setCupomDesconto(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-3"
            >
              <option value="">Nenhum</option>
              {cupons.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} ({c.porcentagem}%)</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-stone-600 mb-1">Desconto (R$)</label>
            <input
              type="number"
              min={0}
              step={0.50}
              value={descontoManual}
              onChange={(e) => setDescontoManual(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-3"
            />
            {contaItensPedido && (valorCupomPrint > 0 || valorManualPrint > 0) && (
              <p className="text-sm text-stone-500 mb-2">
                Desconto: R$ {valorDescontoPrint.toFixed(2)} — Total: R$ {(contaItensPedido.total - valorDescontoPrint).toFixed(2)}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={handleImprimirConta} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700">
                Imprimir
              </button>
              <button onClick={() => setPopupImprimir(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {popupPagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Pagamento da conta (viagem)</h3>
            <p className="text-sm text-stone-500 mb-3">Adicione as frações de pagamento até completar o total.</p>
            <p className="text-sm font-medium text-amber-700 mb-3">Total da conta: R$ {totalContaEncerramento.toFixed(2)}</p>
            <div className="flex gap-2 mb-2">
              <input type="text" inputMode="decimal" value={novaFraçãoValor} onChange={(e) => setNovaFraçãoValor(e.target.value)} placeholder="Valor (ex: 25,50)" className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              <select value={novaFraçãoForma} onChange={(e) => setNovaFraçãoForma(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm min-w-[140px]">
                {formas.map((f) => (<option key={f} value={f}>{f}</option>))}
              </select>
              <button type="button" onClick={adicionarFraçãoViagem} disabled={!novaFraçãoValor.trim() || Number(novaFraçãoValor.replace(',', '.')) <= 0} className="rounded-lg bg-stone-700 px-3 py-2 text-white text-sm hover:bg-stone-800 disabled:opacity-50">Adicionar</button>
            </div>
            {fracoesPagamento.length > 0 && (
              <ul className="mb-3 rounded-lg border border-stone-200 divide-y divide-stone-100 max-h-32 overflow-y-auto">
                {fracoesPagamento.map((f, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{f.forma_pagamento}: R$ {f.valor.toFixed(2)}</span>
                    <button type="button" onClick={() => removerFraçãoViagem(i)} className="text-red-600 hover:underline">Remover</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm font-medium text-stone-700 mb-3">Total pago: R$ {totalPagoViagem.toFixed(2)} {totalPagoViagem >= totalContaEncerramento - 0.01 ? '✓' : `(falta R$ ${(totalContaEncerramento - totalPagoViagem).toFixed(2)})`}</p>
            <div className="flex gap-2">
              <button onClick={confirmarEncerramento} disabled={!podeConfirmarEncerramentoViagem} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">Confirmar encerramento</button>
              <button onClick={() => { setPopupPagamento(null); setFracoesPagamento([]); setNovaFraçãoValor(''); setNovaFraçãoForma(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {popupMoverSelecionadosViagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Mover pedidos selecionados para mesa local</h3>
            <p className="text-sm text-stone-500 mb-3">Escolha a mesa de destino. Se estiver aberta, os {pedidosSelecionadosViagem.size} pedido(s) serão unidos aos existentes. Se estiver livre, informe o cliente para abrir.</p>
            <label className="block text-sm font-medium text-stone-600 mb-1">Mesa de destino</label>
            <select value={mesaIdDestinoViagem} onChange={(e) => setMesaIdDestinoViagem(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-2">
              <option value="">Selecione...</option>
              {mesasDestino.map((m) => (
                <option key={m.mesaId} value={m.mesaId}>{m.mesaNome}{m.comandaId ? ' (aberta)' : ' (livre)'}</option>
              ))}
            </select>
            {mesaIdDestinoViagem && !mesasDestino.find((m) => m.mesaId === mesaIdDestinoViagem)?.comandaId && (
              <>
                <label className="block text-sm font-medium text-stone-600 mb-1 mt-2">Nome do cliente (para abrir a mesa)</label>
                <input type="text" value={novoNomeClienteDestinoViagem} onChange={(e) => setNovoNomeClienteDestinoViagem(e.target.value)} placeholder="Ex: João" className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4" />
              </>
            )}
            {mesaIdDestinoViagem && mesasDestino.find((m) => m.mesaId === mesaIdDestinoViagem)?.comandaId && <p className="text-sm text-stone-500 mb-4">Os pedidos serão unidos aos da mesa.</p>}
            {mesasDestino.length === 0 && <p className="text-sm text-amber-600 mb-2">Nenhuma mesa local disponível.</p>}
            <div className="flex gap-2">
              <button
                onClick={confirmarMoverSelecionadosViagem}
                disabled={!mesaIdDestinoViagem || enviandoTransferenciaViagem || mesasDestino.length === 0 || (!!mesaIdDestinoViagem && !mesasDestino.find((m) => m.mesaId === mesaIdDestinoViagem)?.comandaId && !novoNomeClienteDestinoViagem.trim())}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {enviandoTransferenciaViagem ? 'Transferindo...' : 'Confirmar'}
              </button>
              <button onClick={() => setPopupMoverSelecionadosViagem(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
