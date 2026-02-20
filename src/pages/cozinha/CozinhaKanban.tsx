import { useEffect, useState } from 'react';
import { getPedidosCozinha, updatePedidoStatus } from '../../lib/api';

const COLUNAS = [
  { key: 'novo_pedido', label: 'Novo pedido' },
  { key: 'em_preparacao', label: 'Em preparação' },
  { key: 'finalizado', label: 'Finalizado' },
] as const;

function pedidoGeradoHa(fromAt: string): string {
  const min = Math.floor((Date.now() - new Date(fromAt).getTime()) / 60_000);
  if (min < 1) return 'há menos de 1 min';
  if (min === 1) return 'há 1 min';
  return `há ${min} min`;
}

function dataRefPedido(p: any): string | null {
  if (p.origem === 'online') return p.aceito_em ?? p.created_at ?? null;
  return p.created_at ?? null;
}

function nomeClienteEMesa(p: any) {
  const nome = p.cliente_nome || (p.comandas as any)?.nome_cliente || '-';
  const comandas = p.comandas as any;
  const mesaNum = comandas?.mesas?.numero;
  const mesaNome = comandas?.mesas?.nome;
  if (mesaNum !== undefined && mesaNum !== null && p.origem === 'presencial') {
    return `${nome} - ${mesaNome ?? `Mesa ${mesaNum}`}`;
  }
  return nome;
}

export default function CozinhaKanban() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  // Atualiza "há X minutos" a cada minuto nas duas primeiras colunas
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const data = await getPedidosCozinha();
    setPedidos(data.filter((p) => p.status !== 'cancelado'));
    setLoading(false);
  }

  async function mover(pedidoId: string, novoStatus: 'em_preparacao' | 'finalizado') {
    await updatePedidoStatus(pedidoId, novoStatus);
    load();
  }

  const hoje = new Date().toDateString();

  const porColuna = (key: string) => {
    if (key === 'finalizado') {
      return pedidos.filter((p) => p.status === 'finalizado' && (p.encerrado_em ? new Date(p.encerrado_em).toDateString() === hoje : new Date(p.updated_at).toDateString() === hoje));
    }
    return pedidos.filter((p) => p.status === key);
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
      {COLUNAS.map((col) => (
        <div key={col.key} className="rounded-xl bg-stone-100 p-4 flex flex-col min-h-0">
          <h3 className="font-semibold text-stone-700 mb-3 flex-shrink-0">{col.label}</h3>
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {porColuna(col.key).map((p) => (
              <div key={p.id} className="rounded-lg bg-white p-3 shadow-sm border border-stone-200 flex-shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-stone-800">#{p.numero}</span>
                  <div className="flex flex-col items-end">
                    <span className={`text-xs px-2 py-0.5 rounded ${p.origem === 'online' ? 'bg-blue-100 text-blue-800' : p.origem === 'viagem' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                      {p.origem === 'online' ? 'ONLINE' : p.origem === 'viagem' ? 'VIAGEM' : 'Presencial'}
                    </span>
                    {(col.key === 'novo_pedido' || col.key === 'em_preparacao') && dataRefPedido(p) && (
                      <span className="text-[10px] text-stone-500 mt-0.5">{pedidoGeradoHa(dataRefPedido(p)!)}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-stone-600">{nomeClienteEMesa(p)}</p>
                <ul className="text-sm text-stone-500 mt-1">
                  {(p.pedido_itens ?? []).map((i: any) => (
                    <li key={i.id}>{i.quantidade}x {i.produtos?.descricao} {i.observacao ? ` (${i.observacao})` : ''}</li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  {p.status === 'novo_pedido' && (
                    <button onClick={() => mover(p.id, 'em_preparacao')} className="rounded bg-amber-600 px-2 py-1 text-sm text-white hover:bg-amber-700">
                      Preparar
                    </button>
                  )}
                  {p.status === 'em_preparacao' && (
                    <button onClick={() => mover(p.id, 'finalizado')} className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700">
                      Finalizar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
