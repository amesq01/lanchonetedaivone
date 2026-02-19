import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMesas, initMesas, getConfig, getMesasIdsComPedidosAbertos, getViagemTemPedidosAbertos } from '../../lib/api';
import type { Mesa } from '../../types/database';
import { UtensilsCrossed, Truck } from 'lucide-react';

export default function AdminMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [qtd, setQtd] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mesasComPedidosAbertos, setMesasComPedidosAbertos] = useState<Set<string>>(new Set());
  const [viagemComPedidosAbertos, setViagemComPedidosAbertos] = useState(false);

  function load() {
    getConfig('quantidade_mesas').then(setQtd);
    getMesas().then(setMesas);
    getMesasIdsComPedidosAbertos().then(setMesasComPedidosAbertos);
    getViagemTemPedidosAbertos().then(setViagemComPedidosAbertos);
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
          return (
            <Link
              key={m.id}
              to={m.is_viagem ? '/admin/viagem' : `/admin/mesas/${m.id}`}
              className={`rounded-xl p-4 shadow-sm transition hover:shadow-md flex items-center gap-3 ${
                temPedidosAbertos ? 'bg-amber-50 border-2 border-amber-300' : 'bg-white border border-stone-200'
              }`}
            >
              {m.is_viagem ? <Truck className="h-8 w-8 text-amber-600 flex-shrink-0" /> : <UtensilsCrossed className="h-8 w-8 text-stone-400 flex-shrink-0" />}
              <div className="min-w-0">
                <div className="font-semibold text-stone-800">{m.nome}</div>
                <div className="text-sm text-stone-500">{m.is_viagem ? 'Pedidos para viagem' : `Mesa ${m.numero}`}</div>
                {temPedidosAbertos && <span className="inline-block mt-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Pedidos em aberto</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
