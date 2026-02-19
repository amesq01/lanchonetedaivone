import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMesas, initMesas, getConfig } from '../../lib/api';
import type { Mesa } from '../../types/database';

export default function AdminMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [qtd, setQtd] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig('quantidade_mesas').then(setQtd);
    getMesas().then(setMesas).finally(() => setLoading(false));
  }, []);

  const handleApply = async () => {
    setSaving(true);
    try {
      const updated = await initMesas(qtd);
      setMesas(updated);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

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
        {mesas.map((m) => (
          <Link key={m.id} to={m.is_viagem ? '/admin/viagem' : `/admin/mesas/${m.id}`} className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="font-semibold text-stone-800">{m.nome}</div>
            <div className="text-sm text-stone-500">{m.is_viagem ? 'Pedidos para viagem' : `Mesa ${m.numero}`}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
