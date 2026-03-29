import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, X } from 'lucide-react';
import { fetchPedidosOnlineData, acceptPedidoOnline, setImprimidoEntregaPedido, encerrarPedidoOnline, getTotalAPagarPedido, getTotalPedidoById, getCuponsAtivos, updatePedidoStatus, updatePedidoItens, getProdutos, getMesasFechadasParaTransferencia, getComandaByMesa, openComanda, movePedidosParaOutraComanda, applyDescontoPedidoOnline, clearDescontoPedidoOnline } from '../../lib/api';
import type { FraçãoPagamento } from '../../lib/api';
import { printPedido, printContaViagem } from '../../lib/printPdf';
import { useAuth } from '../../contexts/AuthContext';
import type { Produto } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';
import { queryKeys } from '../../lib/queryClient';

function haXTempo(iso: string | null | undefined): string {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'há <1 min';
  if (min === 1) return 'há 1 min';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h === 1) return 'há 1 h';
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

export default function AdminPedidosOnline() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.pedidosOnline,
    queryFn: fetchPedidosOnlineData,
    staleTime: 60 * 1000,
  });
  const pendentes = data?.pendentes ?? [];
  const todos = data?.todos ?? [];
  const encerradosHoje = data?.encerradosHoje ?? [];
  const loading = isLoading;
  const [searchPedidos, setSearchPedidos] = useState('');
  const [popupCancelar, setPopupCancelar] = useState<{ pedidoId: string; adminOverride?: boolean } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [confirmarEdicaoAvancada, setConfirmarEdicaoAvancada] = useState<any | null>(null);
  const [confirmarAceitar, setConfirmarAceitar] = useState<any | null>(null);
  const { data: produtos = [] } = useQuery({
    queryKey: queryKeys.produtos(true),
    queryFn: () => getProdutos(true),
    staleTime: 60 * 1000,
  });
  const { data: cupons = [] } = useQuery({
    queryKey: queryKeys.cuponsAtivos,
    queryFn: getCuponsAtivos,
    staleTime: Infinity,
  });
  const [popupEditar, setPopupEditar] = useState<any | null>(null);
  const [carrinhoEdicao, setCarrinhoEdicao] = useState<{ produto: Produto; quantidade: number; observacao: string }[]>([]);
  const [searchEdicao, setSearchEdicao] = useState('');
  const [popupEncerrar, setPopupEncerrar] = useState<{ pedido: any; total: number } | null>(null);
  const [fracoesEncerrar, setFracoesEncerrar] = useState<FraçãoPagamento[]>([]);
  const [novaFraçãoValor, setNovaFraçãoValor] = useState('');
  const [novaFraçãoForma, setNovaFraçãoForma] = useState('');
  const [popupEnviarParaMesa, setPopupEnviarParaMesa] = useState<{ pedido: any } | null>(null);
  const [mesasParaEnviar, setMesasParaEnviar] = useState<{ mesaId: string; mesaNome: string }[]>([]);
  const [mesaIdEnviar, setMesaIdEnviar] = useState('');
  const [novoNomeClienteEnviar, setNovoNomeClienteEnviar] = useState('');
  const [enviandoEnviar, setEnviandoEnviar] = useState(false);
  const [popupImprimirConta, setPopupImprimirConta] = useState<any | null>(null);
  const [contaItensPedido, setContaItensPedido] = useState<{ itens: { codigo: string; descricao: string; quantidade: number; valor: number }[]; total: number } | null>(null);
  const [cupomDesconto, setCupomDesconto] = useState('');
  const [descontoManual, setDescontoManual] = useState('');

  const formasPagamento = ['dinheiro', 'pix', 'crédito', 'débito'];
  const normalizarFormaPagamento = (forma: string | null | undefined): string => {
    if (!forma?.trim()) return formasPagamento[0];
    const f = forma.trim();
    const map: Record<string, string> = {
      PIX: 'pix',
      Dinheiro: 'dinheiro',
      Crédito: 'crédito',
      Débito: 'débito',
      'Cartão crédito': 'crédito',
      'Cartão de crédito': 'crédito',
      'Cartão débito': 'débito',
      'Cartão de débito': 'débito',
    };
    if (map[f]) return map[f];
    const fl = f.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
    if (fl.includes('debito')) return 'débito';
    if (fl.includes('credito') && !fl.includes('debito')) return 'crédito';
    return formasPagamento.includes(f)
      ? f
      : (formasPagamento.find((x) => x.toLowerCase() === f.toLowerCase()) ?? f);
  };
  const totalPagoEncerrar = fracoesEncerrar.reduce((s, f) => s + f.valor, 0);
  const totalEncerramento = popupEncerrar?.total ?? 0;
  const contaZeradaOnline = totalEncerramento < 0.01;
  const podeConfirmarEncerrar = popupEncerrar && (contaZeradaOnline || (fracoesEncerrar.length > 0 && totalPagoEncerrar >= totalEncerramento - 0.01));

  const STATUS_EDITAVEL = ['novo_pedido', 'aguardando_aceite'];
  const pedidoPodeEditarSemConfirmacao = (p: any) => STATUS_EDITAVEL.includes(p.status);
  const abrirEdicao = (p: any) => {
    setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' })));
    setSearchEdicao('');
    setPopupEditar(p);
  };

  const invalidatePedidosOnline = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pedidosOnline });
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSidebarCounts });
    queryClient.invalidateQueries({ queryKey: queryKeys.pedidosCozinha });
  };

  const mutationAceitar = useMutation({
    mutationFn: (pedidoId: string) => acceptPedidoOnline(pedidoId),
    onSuccess: invalidatePedidosOnline,
  });
  const mutationEncerrar = useMutation({
    mutationFn: ({ pedidoId, pagamentos }: { pedidoId: string; pagamentos: FraçãoPagamento[] }) => encerrarPedidoOnline(pedidoId, pagamentos),
    onSuccess: invalidatePedidosOnline,
  });
  const mutationCancelar = useMutation({
    mutationFn: ({ pedidoId, motivo, adminOverride }: { pedidoId: string; motivo: string; adminOverride?: boolean }) =>
      updatePedidoStatus(pedidoId, 'cancelado', { motivo_cancelamento: motivo, cancelado_por: profile?.id, adminOverride }),
    onSuccess: invalidatePedidosOnline,
  });
  const mutationEditarItens = useMutation({
    mutationFn: ({ pedidoId, itens }: { pedidoId: string; itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[] }) =>
      updatePedidoItens(pedidoId, itens, { adminOverride: true }),
    onSuccess: invalidatePedidosOnline,
  });
  const mutationImprimirEntrega = useMutation({
    mutationFn: (pedidoId: string) => setImprimidoEntregaPedido(pedidoId),
    onSuccess: invalidatePedidosOnline,
  });

  useEffect(() => {
    if (popupImprimirConta) getTotalPedidoById(popupImprimirConta.id).then(setContaItensPedido);
    else setContaItensPedido(null);
  }, [popupImprimirConta?.id]);

  const handleAbrirImprimirConta = (p: any) => {
    setPopupImprimirConta(p);
    setCupomDesconto(p.cupom_id ?? '');
    setDescontoManual('');
  };

  const cupomSelecionado = cupomDesconto ? cupons.find((c) => c.id === cupomDesconto) : null;
  const subtotalPrint = contaItensPedido ? contaItensPedido.itens.reduce((s, i) => s + i.valor, 0) : 0;
  let valorCupomPrint = cupomSelecionado ? (subtotalPrint * Number(cupomSelecionado.porcentagem)) / 100 : 0;
  if (cupomSelecionado?.valor_maximo != null) valorCupomPrint = Math.min(valorCupomPrint, Number(cupomSelecionado.valor_maximo));
  const valorManualPrint = Math.max(0, Number(descontoManual) || 0);
  const valorDescontoPrint = Math.min(subtotalPrint, valorCupomPrint + valorManualPrint);
  const taxaPrint = Number(popupImprimirConta?.taxa_entrega ?? 0);
  const totalComDescontoPrint = Math.max(0, subtotalPrint - valorDescontoPrint + taxaPrint);

  const handleImprimirConta = async () => {
    if (!popupImprimirConta || !contaItensPedido) return;
    const subtotal = contaItensPedido.itens.reduce((s, i) => s + i.valor, 0);
    if (valorDescontoPrint > 0) {
      await applyDescontoPedidoOnline(popupImprimirConta.id, cupomSelecionado?.id ?? null, valorDescontoPrint);
    } else {
      await clearDescontoPedidoOnline(popupImprimirConta.id);
    }
    await printContaViagem({
      pedidoNumero: popupImprimirConta.numero,
      clienteNome: popupImprimirConta.cliente_nome || '-',
      clienteTelefone: popupImprimirConta.cliente_whatsapp ?? undefined,
      itens: contaItensPedido.itens,
      subtotal,
      valorCupom: valorCupomPrint,
      valorManual: valorManualPrint,
      total: totalComDescontoPrint,
      cupomCodigo: cupomSelecionado?.codigo,
      tipoEntrega: popupImprimirConta.tipo_entrega,
      clienteEndereco: popupImprimirConta.cliente_endereco,
      pontoReferencia: popupImprimirConta.ponto_referencia,
      formaPagamento: popupImprimirConta.forma_pagamento,
      trocoPara: popupImprimirConta.troco_para != null ? Number(popupImprimirConta.troco_para) : undefined,
      taxaEntrega: taxaPrint > 0 ? taxaPrint : undefined,
    });
    setPopupImprimirConta(null);
    setCupomDesconto('');
    setDescontoManual('');
    invalidatePedidosOnline();
  };

  function handleAceitar(pedidoId: string) {
    mutationAceitar.mutate(pedidoId);
  }

  function handleImprimirPedido(p: any) {
    const titulo = p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega';
    printPedido(p, titulo);
    if (p.status === 'finalizado' && !p.imprimido_entrega_em) mutationImprimirEntrega.mutate(p.id);
  }

  function abrirEncerrar(p: any) {
    setPopupEncerrar({ pedido: p, total: totalPedido(p) });
    setFracoesEncerrar([]);
    setNovaFraçãoValor('');
    setNovaFraçãoForma('');
    getTotalAPagarPedido(p.id).then((total) => {
      setPopupEncerrar((prev) => (prev ? { ...prev, total } : null));
      const formaCliente = p.forma_pagamento ? normalizarFormaPagamento(p.forma_pagamento) : null;
      if (total >= 0.01 && formaCliente) {
        setFracoesEncerrar([{ valor: total, forma_pagamento: formaCliente }]);
        setNovaFraçãoValor('0.00');
        setNovaFraçãoForma(formaCliente);
      } else {
        setNovaFraçãoValor(total.toFixed(2));
      }
    });
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

  function confirmarEncerrar() {
    if (!popupEncerrar) return;
    if (totalEncerramento >= 0.01 && fracoesEncerrar.length === 0) return;
    if (totalEncerramento >= 0.01 && totalPagoEncerrar < totalEncerramento - 0.01) {
      alert(`Valor pago (R$ ${totalPagoEncerrar.toFixed(2)}) é menor que o total do pedido (R$ ${totalEncerramento.toFixed(2)}).`);
      return;
    }
    mutationEncerrar.mutate(
      { pedidoId: popupEncerrar.pedido.id, pagamentos: contaZeradaOnline ? [] : fracoesEncerrar },
      {
        onSuccess: () => {
          setPopupEncerrar(null);
          setFracoesEncerrar([]);
        },
        onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao encerrar.'),
      }
    );
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
      invalidatePedidosOnline();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao enviar para mesa.');
    } finally {
      setEnviandoEnviar(false);
    }
  }

  function confirmarCancelarPedido() {
    if (!popupCancelar || !motivoCancelamento.trim()) return;
    mutationCancelar.mutate(
      { pedidoId: popupCancelar.pedidoId, motivo: motivoCancelamento.trim(), adminOverride: popupCancelar.adminOverride },
      {
        onSuccess: () => {
          setPopupCancelar(null);
          setMotivoCancelamento('');
        },
        onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao cancelar.'),
      }
    );
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
  function salvarEdicao() {
    if (!popupEditar || carrinhoEdicao.length === 0) return;
    const itens = carrinhoEdicao.map((i) => ({
      produto_id: i.produto.id,
      quantidade: i.quantidade,
      valor_unitario: precoVenda(i.produto),
      observacao: i.observacao || undefined,
    }));
    mutationEditarItens.mutate(
      { pedidoId: popupEditar.id, itens },
      {
        onSuccess: () => setPopupEditar(null),
        onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao atualizar pedido.'),
      }
    );
  }
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

  const pedidosOnline = [...pendentes, ...todos, ...encerradosHoje];

  const descricaoPagamento = (p: any) => {
    let pag = p.forma_pagamento ?? '-';
    if (p.forma_pagamento && String(p.forma_pagamento).toLowerCase().includes('dinheiro') && p.troco_para != null) {
      pag += ` – Troco R$ ${Number(p.troco_para).toFixed(2)}`;
    }
    return pag;
  };

  const textoCardPedido = (p: any) => {
    const linhas: string[] = [];
    linhas.push(`#${p.numero} – ${p.tipo_entrega === 'retirada' ? 'RETIRADA' : 'ENTREGA'}`);
    linhas.push(`R$ ${totalPedido(p).toFixed(2)}`);
    linhas.push(`${p.cliente_nome} – ${p.cliente_whatsapp ?? ''}`);
    if (p.tipo_entrega === 'entrega') {
      if (p.cliente_endereco) linhas.push(p.cliente_endereco);
      if (p.ponto_referencia) linhas.push(`Ref.: ${p.ponto_referencia}`);
    }
    linhas.push(`Pagamento: ${descricaoPagamento(p)}`);
    const itens = (p.pedido_itens ?? []).map((i: any) => `${i.quantidade}x ${i.produtos?.nome || i.produtos?.descricao}`).join('\n');
    if (itens) linhas.push(itens);
    return linhas.join('\n');
  };

  const copiarClipboard = (texto: string) => {
    navigator.clipboard.writeText(texto).catch(() => {});
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="no-print">
      <h1 className="text-2xl font-bold text-stone-800 mb-1">Pedidos Online</h1>
      <p className="text-sm text-stone-500 mb-4">Colunas do kanban: últimas 12 horas.</p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-600 mb-1">Buscar pedido</label>
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchPedidos}
            onChange={(e) => setSearchPedidos(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearchPedidos('')}
            placeholder="Número do pedido, nome ou WhatsApp..."
            className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-9"
          />
          {searchPedidos.trim() ? (
            <button
              type="button"
              onClick={() => setSearchPedidos('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { titulo: 'Aguardando aceite', statuses: ['aguardando_aceite'], cor: 'stone' },
          { titulo: 'Pedidos aceitos', statuses: ['novo_pedido'], cor: 'blue' },
          { titulo: 'Em preparação', statuses: ['em_preparacao'], cor: 'amber' },
          { titulo: 'Finalizados', statuses: ['finalizado'], cor: 'green' },
        ].map((col) => {
          const s = (searchPedidos || '').trim().toLowerCase();
          const colPedidos = pedidosOnline.filter((p) => {
            if (!col.statuses.includes(p.status)) return false;
            if (!s) return true;
            const numero = String(p.numero ?? '');
            const nome = (p.cliente_nome || '').toLowerCase();
            const whatsapp = (p.cliente_whatsapp || '').replace(/\D/g, '');
            const sDigitos = s.replace(/\D/g, '');
            return numero.includes(s) || nome.includes(s) || (sDigitos && whatsapp.includes(sDigitos)) || (p.cliente_whatsapp || '').toLowerCase().includes(s);
          });
          return (
            <div key={col.titulo} className={`rounded-xl border-2 min-h-[160px] flex flex-col overflow-hidden ${col.cor === 'stone' ? 'border-stone-200 bg-stone-50/30' : col.cor === 'blue' ? 'border-blue-200 bg-blue-50/30' : col.cor === 'amber' ? 'border-amber-200 bg-amber-50/30' : 'border-green-200 bg-green-50/30'}`}>
              <div className={`px-3 py-2 font-semibold text-sm border-b ${col.cor === 'stone' ? 'border-stone-200 text-stone-700' : col.cor === 'blue' ? 'border-blue-200 text-blue-800' : col.cor === 'amber' ? 'border-amber-200 text-amber-800' : 'border-green-200 text-green-800'}`}>
                {col.titulo} ({colPedidos.length})
              </div>
              <div className="flex-1 p-2 space-y-3 overflow-y-auto max-h-[60vh]">
                {colPedidos.map((p) => {
                  const isAguardando = p.status === 'aguardando_aceite';
                  const isFinalizado = p.status === 'finalizado';
                  const jaEncerrado = Boolean(p.encerrado_em);
                  return (
                    <div key={p.id} className={`rounded-lg border bg-white p-3 flex flex-col gap-2 ${isFinalizado && !jaEncerrado ? 'border-amber-400 border-l-4' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-stone-800 text-sm flex items-center gap-1">
                          <span className="min-w-0">#{p.numero} – {p.tipo_entrega === 'retirada' ? 'RETIRADA' : 'ENTREGA'}</span>
                          {isAguardando && (
                            <button type="button" onClick={() => copiarClipboard(textoCardPedido(p))} className="p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100" title="Copiar dados do card">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {p.created_at && <span className="text-stone-500 font-normal text-xs ml-auto shrink-0">{haXTempo(p.created_at)}</span>}
                        </div>
                        <p className="text-xs font-medium text-amber-700">R$ {totalPedido(p).toFixed(2)}</p>
                        <span className="text-xs text-stone-600 inline-flex items-center gap-1">
                          {p.cliente_nome} –{' '}
                          {p.cliente_whatsapp ? (
                            <>
                              {isAguardando ? (
                                <>
                                  {p.cliente_whatsapp}
                                  <button
                                    type="button"
                                    onClick={() => copiarClipboard(p.cliente_whatsapp ?? '')}
                                    className="p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                                    title="Copiar telefone"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => copiarClipboard(p.cliente_whatsapp ?? '')}
                                  className="underline decoration-dotted underline-offset-2 hover:text-stone-800"
                                  title="Copiar telefone"
                                >
                                  {p.cliente_whatsapp}
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-stone-400">sem telefone</span>
                          )}
                        </span>
                        <div className="mt-1 flex flex-col gap-0.5 text-xs text-stone-600">
                          {p.tipo_entrega === 'entrega' && (
                            <>
                              {p.cliente_endereco && <span>{p.cliente_endereco}</span>}
                              {p.ponto_referencia && <span>Ref.: {p.ponto_referencia}</span>}
                            </>
                          )}
                          <span>Pagamento: {descricaoPagamento(p)}</span>
                        </div>
                        {!isAguardando && <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${jaEncerrado ? 'bg-green-200 text-green-800 font-medium' : 'bg-stone-100 text-stone-600'}`}>{jaEncerrado ? 'Entregue' : (statusLabel[p.status] ?? p.status)}</span>}
                        <ul className="mt-1 text-xs text-stone-600 line-clamp-2">
                          {(p.pedido_itens ?? []).map((i: any) => (
                            <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {jaEncerrado ? (
                          <button type="button" onClick={() => handleImprimirPedido(p)} className="rounded border border-stone-300 px-2 py-1 text-stone-600 hover:bg-stone-50">Reimprimir</button>
                        ) : !(isFinalizado && !jaEncerrado) && (
                          <button type="button" onClick={() => handleImprimirPedido(p)} className="rounded border border-stone-300 px-2 py-1 text-stone-600 hover:bg-stone-50">Imprimir</button>
                        )}
                        {!jaEncerrado && (
                          <>
                            <button type="button" onClick={() => (pedidoPodeEditarSemConfirmacao(p) ? abrirEdicao(p) : setConfirmarEdicaoAvancada(p))} className="rounded border border-amber-300 px-2 py-1 text-amber-700 hover:bg-amber-50">Editar</button>
                            <button type="button" onClick={() => setPopupCancelar({ pedidoId: p.id, adminOverride: !pedidoPodeEditarSemConfirmacao(p) })} className="rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50">Cancelar</button>
                          </>
                        )}
                        {isAguardando && (
                          <button type="button" onClick={() => setConfirmarAceitar(p)} className="rounded border border-green-600 bg-green-600 px-2 py-1 text-white font-medium hover:bg-green-700">Aceitar</button>
                        )}
                        {!jaEncerrado && (
                          <button type="button" onClick={() => abrirEnviarParaMesa(p)} className="rounded border border-stone-300 px-2 py-1 text-stone-600 hover:bg-stone-50">Enviar para mesa</button>
                        )}
                        {isFinalizado && !jaEncerrado && (
                          <>
                            <button type="button" onClick={() => handleAbrirImprimirConta(p)} className="rounded border border-stone-300 px-2 py-1 text-stone-600 hover:bg-stone-50">Imprimir conta</button>
                            <button type="button" onClick={() => abrirEncerrar(p)} className="rounded border border-amber-400 bg-amber-100 px-2 py-1 text-amber-700 font-medium hover:bg-amber-200">Encerrar pedido</button>
                          </>
                        )}
                      </div>
                      {!jaEncerrado && (p.status === 'novo_pedido' || p.status === 'em_preparacao') && pedidoTemItemParaCozinha(p) && (
                        <span className="text-xs text-stone-500">Aguardando cozinha</span>
                      )}
                      {jaEncerrado && (
                        <span className="text-xs text-green-700">Encerrado – {p.forma_pagamento ?? '-'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {popupImprimirConta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="font-semibold text-stone-800 mb-4">Imprimir conta - Pedido #{popupImprimirConta.numero}</h3>
            <p className="text-sm text-stone-500 mb-3">{popupImprimirConta.cliente_nome}</p>
            <label className="block text-sm font-medium text-stone-600 mb-1">Cupom de desconto</label>
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
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                min={0}
                step={0.5}
                value={descontoManual}
                onChange={(e) => setDescontoManual(e.target.value)}
                placeholder="0,00"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
              />
              {(cupomDesconto || descontoManual) && (
                <button
                  type="button"
                  onClick={() => { setCupomDesconto(''); setDescontoManual(''); }}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 whitespace-nowrap"
                >
                  Remover desconto
                </button>
              )}
            </div>
            {contaItensPedido && (valorCupomPrint > 0 || valorManualPrint > 0) && (
              <p className="text-sm text-stone-500 mb-2">
                Desconto: R$ {valorDescontoPrint.toFixed(2)} — Total: R$ {totalComDescontoPrint.toFixed(2)}
              </p>
            )}
            {contaItensPedido && valorCupomPrint === 0 && valorManualPrint === 0 && (
              <p className="text-sm font-medium text-amber-700 mb-3">Total: R$ {contaItensPedido.total.toFixed(2)}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={handleImprimirConta} disabled={!contaItensPedido} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">Imprimir</button>
              <button onClick={() => { setPopupImprimirConta(null); setCupomDesconto(''); setDescontoManual(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={salvarEdicao} disabled={mutationEditarItens.isPending || carrinhoEdicao.length === 0} className="flex-1 rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50">Salvar alterações</button>
              <button onClick={() => setPopupEditar(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {confirmarAceitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Aceitar pedido</h3>
            <p className="text-sm text-stone-600 mb-4">Deseja aceitar o pedido #{confirmarAceitar.numero}?</p>
            <div className="flex gap-2">
              <button onClick={() => { handleAceitar(confirmarAceitar.id); setConfirmarAceitar(null); }} className="flex-1 rounded-lg bg-green-600 py-2 text-white hover:bg-green-700">Sim, aceitar</button>
              <button onClick={() => setConfirmarAceitar(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Não</button>
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

    </div>
  );
}
