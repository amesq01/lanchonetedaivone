import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMesas, initMesas, getConfig, getMesasIdsComPedidosAbertos, getMesasIdsComContaPendente, getViagemTemPedidosAbertos, getPedidosPresencialEncerradosHoje } from '../../lib/api';
import type { Mesa } from '../../types/database';
import { UtensilsCrossed, Truck } from 'lucide-react';

export default function AdminMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [qtd, setQtd] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mesasComPedidosAbertos, setMesasComPedidosAbertos] = useState<Set<string>>(new Set());
  const [mesasComContaPendente, setMesasComContaPendente] = useState<Set<string>>(new Set());
  const [viagemComPedidosAbertos, setViagemComPedidosAbertos] = useState(false);
  const [pedidosFinalizadosHoje, setPedidosFinalizadosHoje] = useState<any[]>([]);
  const [accordionFinalizados, setAccordionFinalizados] = useState(false);

  function load() {
    getConfig('quantidade_mesas').then(setQtd);
    getMesas().then(setMesas);
    getMesasIdsComPedidosAbertos().then(setMesasComPedidosAbertos);
    getMesasIdsComContaPendente().then(setMesasComContaPendente);
    getViagemTemPedidosAbertos().then(setViagemComPedidosAbertos);
    getPedidosPresencialEncerradosHoje().then(setPedidosFinalizadosHoje);
  }

  function totalPedido(p: any) {
    const sub = (p.pedido_itens ?? []).reduce((s: number, i: any) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
    return (Number.isFinite(sub) ? sub : 0);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setLoading(false);
  }, [mesas]);

  const handleApply = async () => {
    setSaving(true);
    try {
      const updated = await initMesas(qtd);
      setMesas(updated);
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading && mesas.length === 0) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Mesas</h1>
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-stone-600">Quantidade de mesas no salão</label>
          <input type="number" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        <button onClick={handleApply} disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
          {saving ? 'Aplicando...' : 'Aplicar'}
        </button>
        <p className="text-sm text-stone-500">A mesa VIAGEM é criada automaticamente.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mesas.map((m) => {
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
                <div className="font-semibold text-stone-800">{m.nome}</div>
                <div className="text-sm text-stone-500">{m.is_viagem ? 'Pedidos para viagem' : `Mesa ${m.numero}`}</div>
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
          Pedidos finalizados hoje (mesas)
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
