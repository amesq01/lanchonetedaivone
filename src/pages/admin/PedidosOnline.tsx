import { useEffect, useState } from 'react';
import { getPedidosOnlinePendentes, acceptPedidoOnline } from '../../lib/api';

export default function AdminPedidosOnline() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await getPedidosOnlinePendentes();
    setPedidos(data);
    setLoading(false);
  }

  async function handleAceitar(pedidoId: string) {
    await acceptPedidoOnline(pedidoId);
    load();
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Pedidos Online</h1>
      <p className="text-stone-600 mb-4">Aceite os pedidos para que apareçam no kanban da cozinha.</p>
      <div className="space-y-4">
        {pedidos.length === 0 ? (
          <p className="text-stone-500">Nenhum pedido pendente.</p>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
                <p className="text-sm text-stone-600">{p.cliente_nome} - {p.cliente_whatsapp}</p>
                <p className="text-sm text-stone-500">{p.cliente_endereco}</p>
                <p className="text-sm">Pagamento: {p.forma_pagamento} {p.troco_para ? `- Troco para R$ ${p.troco_para}` : ''}</p>
                {p.observacoes && <p className="text-sm italic text-stone-500">{p.observacoes}</p>}
                <ul className="mt-2 text-sm">
                  {(p.pedido_itens ?? []).map((i: any) => (
                    <li key={i.id}>{i.quantidade}x {i.produtos?.descricao} {i.observacao ? `(${i.observacao})` : ''}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => handleAceitar(p.id)} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                Aceitar pedido
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
