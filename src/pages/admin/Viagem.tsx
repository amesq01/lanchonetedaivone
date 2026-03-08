import { useEffect, useState } from 'react';
import { getPedidosViagemAbertos, getTotalComanda, getCuponsAtivos, applyDescontoComanda, clearDescontoComanda, getProdutos, updatePedidoItens } from '../../lib/api';
import { printContaViagem } from '../../lib/printPdf';
import { supabase } from '../../lib/supabase';
import type { Cupom } from '../../types/database';
import type { Produto } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';

export default function AdminViagem() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accordionFinalizados, setAccordionFinalizados] = useState(false);
  const [popupPagamento, setPopupPagamento] = useState<{ pedidoId: string; comandaId: string } | null>(null);
  const [formaPagamento, setFormaPagamento] = useState('');
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
  };

  const confirmarEncerramento = async () => {
    if (!popupPagamento || !formaPagamento) return;
    const now = new Date().toISOString();
    await (supabase as any).from('comandas').update({ aberta: false, forma_pagamento: formaPagamento, encerrada_em: now }).eq('id', popupPagamento.comandaId);
    await (supabase as any).from('pedidos').update({ encerrado_em: now, forma_pagamento: formaPagamento, updated_at: now }).eq('id', popupPagamento.pedidoId);
    setPopupPagamento(null);
    setFormaPagamento('');
    load();
  };

  const formas = ['dinheiro', 'pix', 'cartão de crédito', 'cartão de débito'];

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
      await updatePedidoItens(popupEditar.id, itens);
      setPopupEditar(null);
      load();
    } finally {
      setEnviandoEdicao(false);
    }
  };
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

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="no-print">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Mesa VIAGEM</h1>
      <p className="text-stone-600 mb-4">Pedidos para viagem. Encerre cada pedido após o pagamento.</p>

      <div className="space-y-4">
        {emPreparacao.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm flex flex-wrap items-stretch justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800">{(p.comandas as any)?.profiles?.nome ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}` : `Pedido #${p.numero}`}</div>
              <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
              <span className="text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              <ul className="mt-2 text-sm text-stone-600">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
            </div>
            <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
              {p.status === 'novo_pedido' && (
                <button type="button" onClick={() => { setPopupEditar(p); setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' }))); setSearchEdicao(''); }} className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 mb-2">
                  Editar pedido
                </button>
              )}
              <span className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                Aguardando finalização na cozinha
              </span>
            </div>
          </div>
        ))}
        {prontosEncerrar.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm border-l-4 border-amber-500 flex flex-wrap items-stretch justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800">{(p.comandas as any)?.profiles?.nome ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}` : `Pedido #${p.numero}`}</div>
              <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
              <span className="text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              <ul className="mt-2 text-sm text-stone-600">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
            </div>
            <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
              {p.status === 'novo_pedido' && (
                <button type="button" onClick={() => { setPopupEditar(p); setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' }))); setSearchEdicao(''); }} className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">
                  Editar pedido
                </button>
              )}
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

      <div className="mt-8">
        <button onClick={() => setAccordionFinalizados(!accordionFinalizados)} className="flex w-full items-center justify-between rounded-lg bg-stone-100 px-4 py-2 text-left font-medium text-stone-700">
          Pedidos finalizados
          <span>{accordionFinalizados ? '−' : '+'}</span>
        </button>
        {accordionFinalizados && (
          <div className="mt-2 space-y-2">
            {finalizadosEncerrados.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm flex flex-wrap justify-between items-center gap-2">
                <span>#{p.numero}{(p.comandas as any)?.profiles?.nome ? ` – ${(p.comandas as any).profiles.nome}` : ''} - {(p.comandas as any)?.nome_cliente ?? p.cliente_nome} - {p.forma_pagamento ?? '-'}</span>
                <span className="font-medium text-amber-700">R$ {totalPedido(p).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {popupImprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="font-semibold text-stone-800 mb-4">Imprimir conta - Pedido #{popupImprimir.numero}{(popupImprimir.comandas as any)?.profiles?.nome ? ` – ${(popupImprimir.comandas as any).profiles.nome}` : ''}</h3>
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
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-4">Forma de pagamento</h3>
            <div className="space-y-2">
              {formas.map((f) => (
                <button key={f} onClick={() => setFormaPagamento(f)} className={`block w-full rounded-lg border py-2 text-left px-3 ${formaPagamento === f ? 'border-amber-500 bg-amber-50' : 'border-stone-200'}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmarEncerramento} disabled={!formaPagamento} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                Confirmar encerramento
              </button>
              <button onClick={() => setPopupPagamento(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
