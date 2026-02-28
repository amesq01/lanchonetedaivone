import { useEffect, useState } from 'react';
import { getPedidosOnlinePendentes, getPedidosOnlineTodos, getPedidosOnlineEncerradosHoje, acceptPedidoOnline, setImprimidoEntregaPedido, encerrarPedidoOnline, updatePedidoStatus } from '../../lib/api';
import { printPedidoEntrega } from '../../lib/printPdf';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminPedidosOnline() {
  const { profile } = useAuth();
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [encerradosHoje, setEncerradosHoje] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accordionEncerrados, setAccordionEncerrados] = useState(false);
  const [popupCancelar, setPopupCancelar] = useState<{ pedidoId: string } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

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
  }, []);

  async function handleAceitar(pedidoId: string) {
    await acceptPedidoOnline(pedidoId);
    load();
  }

  function handleImprimirEntrega(p: any) {
    printPedidoEntrega(p);
    setImprimidoEntregaPedido(p.id).then(load);
  }

  async function handleEncerrar(pedidoId: string) {
    await encerrarPedidoOnline(pedidoId);
    load();
  }

  async function confirmarCancelarPedido() {
    if (!popupCancelar || !motivoCancelamento.trim()) return;
    await updatePedidoStatus(popupCancelar.pedidoId, 'cancelado', {
      motivo_cancelamento: motivoCancelamento.trim(),
      cancelado_por: profile?.id,
    });
    setPopupCancelar(null);
    setMotivoCancelamento('');
    load();
  }

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
                <div className="flex items-center gap-2">
                  <button onClick={() => handleAceitar(p.id)} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                    Aceitar pedido
                  </button>
                  <button onClick={() => setPopupCancelar({ pedidoId: p.id })} className="rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50">
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
                  {p.status === 'finalizado' && (
                    <>
                      {!p.imprimido_entrega_em ? (
                        <button onClick={() => handleImprimirEntrega(p)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-50">
                          Imprimir pedido para entrega
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleEncerrar(p.id)} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
                            Encerrar pedido
                          </button>
                          <button onClick={() => handleImprimirEntrega(p)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
                            Reimprimir
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {pedidoTemItemParaCozinha(p) && (p.status === 'novo_pedido' || p.status === 'em_preparacao') && (
                    <span className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                      Aguardando finalização na cozinha
                    </span>
                  )}
                  <button onClick={() => setPopupCancelar({ pedidoId: p.id })} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                    Cancelar pedido
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {popupCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Cancelar pedido</h3>
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
