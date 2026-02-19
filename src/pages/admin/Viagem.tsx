import { useEffect, useState } from 'react';
import { getPedidosViagemAbertos, getTotalComanda, updatePedidoStatus } from '../../lib/api';
import { supabase } from '../../lib/supabase';

export default function AdminViagem() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [finalizados, setFinalizados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accordionFinalizados, setAccordionFinalizados] = useState(false);
  const [popupPagamento, setPopupPagamento] = useState<{ pedidoId: string; comandaId: string } | null>(null);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [printPedidoId, setPrintPedidoId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const abertos = await getPedidosViagemAbertos();
    setPedidos(abertos.filter((p) => p.status !== 'finalizado' && p.status !== 'cancelado'));
    const { data } = await supabase.from('pedidos').select('*, comandas(nome_cliente)').eq('origem', 'viagem').eq('status', 'finalizado').order('encerrado_em', { ascending: false });
    setFinalizados((data ?? []) as any[]);
    setLoading(false);
  }

  async function getTotalPedido(pedidoId: string) {
    const { data: ped } = await supabase.from('pedidos').select('comanda_id').eq('id', pedidoId).single();
    if (!ped?.comanda_id) return { itens: [], total: 0 };
    return getTotalComanda(ped.comanda_id);
  }

  const handleFinalizarPedido = (pedido: any) => {
    setPrintPedidoId(pedido.id);
    setTimeout(() => {
      window.print();
      setPrintPedidoId(null);
    }, 100);
  };

  const handleEncerrarPedido = (pedido: any) => {
    setPopupPagamento({ pedidoId: pedido.id, comandaId: pedido.comanda_id });
  };

  const confirmarEncerramento = async () => {
    if (!popupPagamento || !formaPagamento) return;
    await supabase.from('comandas').update({ aberta: false, forma_pagamento: formaPagamento, encerrada_em: new Date().toISOString() }).eq('id', popupPagamento.comandaId);
    await updatePedidoStatus(popupPagamento.pedidoId, 'finalizado');
    await supabase.from('pedidos').update({ encerrado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', popupPagamento.pedidoId);
    setPopupPagamento(null);
    setFormaPagamento('');
    load();
  };

  const formas = ['dinheiro', 'pix', 'cartão crédito', 'cartão débito'];

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Mesa VIAGEM</h1>
      <p className="text-stone-600 mb-4">Pedidos para viagem. Encerre cada pedido após o pagamento.</p>

      <div className="space-y-4">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-stone-800">Pedido #{p.numero}</span>
                <span className="ml-2 text-stone-600">- {p.cliente_nome || (p.comandas as any)?.nome_cliente}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleFinalizarPedido(p)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">
                  Imprimir conta
                </button>
                <button onClick={() => handleEncerrarPedido(p)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700">
                  Encerrar pedido
                </button>
              </div>
            </div>
            <ul className="mt-2 text-sm text-stone-600">
              {(p.pedido_itens ?? []).map((i: any) => (
                <li key={i.id}>{i.quantidade}x {i.produtos?.descricao}</li>
              ))}
            </ul>
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
            {finalizados.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm">
                #{p.numero} - {(p.comandas as any)?.nome_cliente ?? p.cliente_nome} - R$ (total)
              </div>
            ))}
          </div>
        )}
      </div>

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
