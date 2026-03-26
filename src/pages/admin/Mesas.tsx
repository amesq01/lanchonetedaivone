import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMesas, initMesas, getConfig, getMesasIdsComPedidosAbertos, getMesasIdsComContaPendente, getViagemTemPedidosAbertos, getPedidosPresencialEncerradosHoje, getMesasComComandaAberta } from '../../lib/api';
import type { Mesa } from '../../types/database';
import { UtensilsCrossed, Truck, Search } from 'lucide-react';
import { queryKeys } from '../../lib/queryClient';

async function fetchMesasDashboard() {
  const [qtd, mesas, mesasComPedidosAbertos, mesasComContaPendente, viagemComPedidosAbertos, pedidosFinalizadosHoje, listaComandas] = await Promise.all([
    getConfig('quantidade_mesas'),
    getMesas(),
    getMesasIdsComPedidosAbertos(),
    getMesasIdsComContaPendente(),
    getViagemTemPedidosAbertos(),
    getPedidosPresencialEncerradosHoje(),
    getMesasComComandaAberta(),
  ]);
  const atendentePorMesa: Record<string, string> = {};
  const clientePorMesa: Record<string, string> = {};
  const clienteNomesPorMesa: Record<string, string[]> = {};
  const pedidosNumerosPorMesa: Record<string, number[]> = {};
  (listaComandas as { mesa_id: string; atendente_nome: string; nome_cliente: string | null; pedidos_numeros: number[] }[]).forEach(({ mesa_id, atendente_nome, nome_cliente, pedidos_numeros }) => {
    atendentePorMesa[mesa_id] = atendente_nome;
    const nome = nome_cliente?.trim();
    if (nome) {
      if (!clientePorMesa[mesa_id]) clientePorMesa[mesa_id] = nome;
      clienteNomesPorMesa[mesa_id] = [...(clienteNomesPorMesa[mesa_id] ?? []), nome];
    }
    if (pedidos_numeros?.length) {
      pedidosNumerosPorMesa[mesa_id] = [...(pedidosNumerosPorMesa[mesa_id] ?? []), ...pedidos_numeros];
    }
  });
  Object.keys(pedidosNumerosPorMesa).forEach((id) => {
    pedidosNumerosPorMesa[id] = [...new Set(pedidosNumerosPorMesa[id])].sort((a, b) => a - b);
  });
  return {
    qtd: Number(qtd) || 10,
    mesas: mesas as Mesa[],
    mesasComPedidosAbertos: mesasComPedidosAbertos as Set<string>,
    mesasComContaPendente: mesasComContaPendente as Set<string>,
    viagemComPedidosAbertos: Boolean(viagemComPedidosAbertos),
    pedidosFinalizadosHoje: pedidosFinalizadosHoje as any[],
    atendentePorMesa,
    clientePorMesa,
    clienteNomesPorMesa,
    pedidosNumerosPorMesa,
  };
}

export default function AdminMesas() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mesasDashboard,
    queryFn: fetchMesasDashboard,
    staleTime: 30 * 1000,
  });
  const [qtd, setQtd] = useState(10);
  const [saving, setSaving] = useState(false);
  const [accordionFinalizados, setAccordionFinalizados] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (data?.qtd != null) setQtd(data.qtd);
  }, [data?.qtd]);

  const mesas = data?.mesas ?? [];
  const mesasComPedidosAbertos = data?.mesasComPedidosAbertos ?? new Set<string>();
  const mesasComContaPendente = data?.mesasComContaPendente ?? new Set<string>();
  const viagemComPedidosAbertos = data?.viagemComPedidosAbertos ?? false;
  const pedidosFinalizadosHoje = data?.pedidosFinalizadosHoje ?? [];
  const atendentePorMesa = data?.atendentePorMesa ?? {};
  const clientePorMesa = data?.clientePorMesa ?? {};
  const clienteNomesPorMesa = data?.clienteNomesPorMesa ?? {};
  const pedidosNumerosPorMesa = data?.pedidosNumerosPorMesa ?? {};
  const loading = isLoading;

  function totalPedido(p: any) {
    const sub = (p.pedido_itens ?? []).reduce((s: number, i: any) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
    return (Number.isFinite(sub) ? sub : 0);
  }

  const handleApply = async () => {
    setSaving(true);
    try {
      await initMesas(qtd);
      queryClient.invalidateQueries({ queryKey: queryKeys.mesasDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSidebarCounts });
    } finally {
      setSaving(false);
    }
  };

  const searchNorm = search.trim().toLowerCase();
  const mesasFiltradas = !searchNorm
    ? mesas
    : mesas.filter((m) => {
        const nomesCliente = clienteNomesPorMesa[m.id] ?? (clientePorMesa[m.id] ? [clientePorMesa[m.id]] : []);
        const numeros = pedidosNumerosPorMesa[m.id] ?? [];
        const matchCliente = nomesCliente.some((n) => n.toLowerCase().includes(searchNorm));
        const matchNumero = numeros.some((n) => String(n) === searchNorm.replace(/^#/, '') || String(n).includes(searchNorm.replace(/^#/, '')));
        return matchCliente || matchNumero;
      });

  if (loading && mesas.length === 0) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-stone-800 mb-4 sm:mb-6">Mesas</h1>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-end gap-3 sm:gap-4 rounded-xl bg-white p-3 sm:p-4 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-stone-600">Quantidade de mesas no salão</label>
          <input type="number" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        <button onClick={handleApply} disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
          {saving ? 'Aplicando...' : 'Aplicar'}
        </button>
        <p className="text-sm text-stone-500">A mesa VIAGEM é criada automaticamente.</p>
      </div>
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm border border-stone-200">
        <Search className="h-5 w-5 text-stone-400 flex-shrink-0" />
        <input
          type="search"
          placeholder="Buscar por nome do cliente ou número do pedido (#222)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          className="flex-1 min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-stone-800 placeholder:text-stone-400"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mesasFiltradas.map((m) => {
          const temPedidosAbertos = m.is_viagem ? viagemComPedidosAbertos : mesasComPedidosAbertos.has(m.id);
          const temContaPendente = !m.is_viagem && mesasComContaPendente.has(m.id);
          const destacar = temPedidosAbertos || temContaPendente;
          return (
            <Link
              key={m.id}
              to={m.is_viagem ? '/admin/viagem' : `/admin/mesas/${m.id}`}
              className={`rounded-xl p-4 shadow-sm transition hover:shadow-md flex items-center gap-3 ${
                destacar ? 'bg-amber-50 border-2 border-amber-300' : 'bg-white border border-stone-200'
              }`}
            >
              {m.is_viagem ? <Truck className="h-8 w-8 text-amber-600 flex-shrink-0" /> : <UtensilsCrossed className="h-8 w-8 text-stone-400 flex-shrink-0" />}
              <div className="min-w-0">
                <div className="font-semibold text-stone-800 uppercase">{m.nome}</div>
                {m.is_viagem && <div className="text-sm text-stone-500">Pedidos para viagem</div>}
                {!m.is_viagem && (clientePorMesa[m.id] || pedidosNumerosPorMesa[m.id]?.length) && (
                  <div className="text-sm mt-0.5 truncate" title={clientePorMesa[m.id] || ''}>
                    {clientePorMesa[m.id] && <span className="font-semibold text-stone-800">{clientePorMesa[m.id]}</span>}
                    {pedidosNumerosPorMesa[m.id]?.length ? (
                      <span className="text-stone-600">{clientePorMesa[m.id] ? ' – ' : ''}{pedidosNumerosPorMesa[m.id].map((n) => `#${n}`).join(', ')}</span>
                    ) : null}
                  </div>
                )}
                {!m.is_viagem && atendentePorMesa[m.id] && (
                  <div className="text-xs text-stone-500 mt-0.5 truncate" title={`Aberta por ${atendentePorMesa[m.id]}`}>Aberta por {atendentePorMesa[m.id]}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {temPedidosAbertos && <span className="inline-block text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Pedidos em aberto</span>}
                  {temContaPendente && <span className="inline-block text-xs font-medium text-amber-800 bg-amber-200 px-2 py-0.5 rounded">Conta pendente de encerramento</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <button onClick={() => setAccordionFinalizados(!accordionFinalizados)} className="flex w-full items-center justify-between rounded-lg bg-stone-100 px-4 py-2 text-left font-medium text-stone-700">
          Pedidos finalizados hoje! (mesas)
          <span>{accordionFinalizados ? '−' : '+'}</span>
        </button>
        {accordionFinalizados && (
          <div className="mt-2 space-y-2">
            {pedidosFinalizadosHoje.length === 0 ? (
              <p className="text-sm text-stone-500 py-2">Nenhum pedido de mesa encerrado hoje.</p>
            ) : (
              pedidosFinalizadosHoje.map((p) => {
                const comanda = p.comandas as any;
                const mesaNome = comanda?.mesas?.nome ?? (comanda?.mesas?.numero != null ? `Mesa ${comanda.mesas.numero}` : '-');
                return (
                  <div key={p.id} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm flex flex-wrap justify-between items-center gap-2">
                    <span>#{p.numero} - {mesaNome} - {comanda?.nome_cliente ?? p.cliente_nome} - {p.forma_pagamento ?? '-'}</span>
                    <span className="font-medium text-amber-700">R$ {totalPedido(p).toFixed(2)}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
