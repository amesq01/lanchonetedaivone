import { useEffect, useState } from 'react';
import { getPedidosViagemAbertos, getTotalComanda, getCuponsAtivos, applyDescontoComanda, clearDescontoComanda } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Cupom } from '../../types/database';

export default function AdminViagem() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accordionFinalizados, setAccordionFinalizados] = useState(false);
  const [popupPagamento, setPopupPagamento] = useState<{ pedidoId: string; comandaId: string } | null>(null);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [popupImprimir, setPopupImprimir] = useState<any | null>(null);
  const [contaItensPedido, setContaItensPedido] = useState<{ itens: { codigo: string; descricao: string; quantidade: number; valor: number }[]; total: number } | null>(null);
  const [cupomDesconto, setCupomDesconto] = useState('');
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [printMode, setPrintMode] = useState(false);
  const [printData, setPrintData] = useState<{ pedido: any; contaItens: { itens: any[]; total: number }; valorDesconto: number; cupomSelecionado: Cupom | null } | null>(null);

  useEffect(() => {
    load();
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
    const valorDesconto = cupomSelecionado ? (subtotal * Number(cupomSelecionado.porcentagem)) / 100 : 0;
    if (cupomSelecionado && valorDesconto > 0) {
      await applyDescontoComanda(popupImprimir.comanda_id, cupomSelecionado.id, valorDesconto);
      contaParaPrint = await getTotalPedido(popupImprimir.id);
      setContaItensPedido(contaParaPrint);
    } else {
      await clearDescontoComanda(popupImprimir.comanda_id);
    }
    setPrintData({
      pedido: popupImprimir,
      contaItens: { itens: contaParaPrint.itens, total: subtotal - valorDesconto },
      valorDesconto,
      cupomSelecionado: cupomSelecionado ?? null,
    });
    setPrintMode(true);
    setPopupImprimir(null);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
      setPrintData(null);
    }, 150);
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

  const formas = ['dinheiro', 'pix', 'cartão crédito', 'cartão débito'];

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
  const valorDescontoPrint = cupomSelecionado ? (subtotalPrint * Number(cupomSelecionado.porcentagem)) / 100 : 0;

  if (printMode && printData) {
    const { pedido, contaItens, valorDesconto, cupomSelecionado: cupom } = printData;
    const clienteNome = pedido.cliente_nome || (pedido.comandas as any)?.nome_cliente || '-';
    return (
      <div className="bg-white p-6 text-stone-800">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Lanchonete & Sushi</h1>
          <p className="mt-2 text-lg">Pedido #{pedido.numero} - VIAGEM - {clienteNome}</p>
        </div>
        <table className="w-full border-collapse border border-stone-200 text-sm mt-4">
          <thead>
            <tr className="bg-stone-100">
              <th className="border border-stone-200 px-2 py-1.5 text-left font-semibold">Código</th>
              <th className="border border-stone-200 px-2 py-1.5 text-left font-semibold">Produto</th>
              <th className="border border-stone-200 px-2 py-1.5 text-center font-semibold">Quantidade</th>
              <th className="border border-stone-200 px-2 py-1.5 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {contaItens.itens.map((item: any, i: number) => (
              <tr key={i}>
                <td className="border border-stone-200 px-2 py-1">{item.codigo}</td>
                <td className="border border-stone-200 px-2 py-1">{item.descricao}</td>
                <td className="border border-stone-200 px-2 py-1 text-center">{item.quantidade}</td>
                <td className="border border-stone-200 px-2 py-1 text-right">R$ {item.valor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R$ {(contaItens.total + valorDesconto).toFixed(2)}</span>
          </div>
          {cupom && valorDesconto > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Desconto ({cupom.codigo} - {cupom.porcentagem}%)</span>
              <span>- R$ {valorDesconto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-stone-200">
            <span>Total</span>
            <span>R$ {contaItens.total.toFixed(2)}</span>
          </div>
        </div>
        <footer className="text-center mt-8 pt-4 text-stone-500 text-sm">
          Obrigado! Volte sempre.
        </footer>
      </div>
    );
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="no-print">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Mesa VIAGEM</h1>
      <p className="text-stone-600 mb-4">Pedidos para viagem. Encerre cada pedido após o pagamento.</p>

      <div className="space-y-4">
        {emPreparacao.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm flex flex-wrap items-stretch justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
              <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
              <span className="text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              <ul className="mt-2 text-sm text-stone-600">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
            </div>
            <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
              <span className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                Aguardando finalização na cozinha
              </span>
            </div>
          </div>
        ))}
        {prontosEncerrar.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm border-l-4 border-amber-500 flex flex-wrap items-stretch justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
              <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
              <span className="text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              <ul className="mt-2 text-sm text-stone-600">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
            </div>
            <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
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

      <div className="mt-8">
        <button onClick={() => setAccordionFinalizados(!accordionFinalizados)} className="flex w-full items-center justify-between rounded-lg bg-stone-100 px-4 py-2 text-left font-medium text-stone-700">
          Pedidos finalizados
          <span>{accordionFinalizados ? '−' : '+'}</span>
        </button>
        {accordionFinalizados && (
          <div className="mt-2 space-y-2">
            {finalizadosEncerrados.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm flex flex-wrap justify-between items-center gap-2">
                <span>#{p.numero} - {(p.comandas as any)?.nome_cliente ?? p.cliente_nome} - {p.forma_pagamento ?? '-'}</span>
                <span className="font-medium text-amber-700">R$ {totalPedido(p).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {popupImprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-4">Imprimir conta - Pedido #{popupImprimir.numero}</h3>
            <label className="block text-sm font-medium text-stone-600 mb-2">Desconto (cupom)</label>
            <select
              value={cupomDesconto}
              onChange={(e) => setCupomDesconto(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4"
            >
              <option value="">Nenhum</option>
              {cupons.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} ({c.porcentagem}%)</option>
              ))}
            </select>
            {cupomSelecionado && contaItensPedido && (
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
