import { useEffect, useState } from 'react';
import { getConfig, setConfig } from '../../lib/api';

export default function AdminTaxaEntrega() {
  const [valor, setValor] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig('taxa_entrega').then((v) => setValor(String(v))).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setConfig('taxa_entrega', Number(valor));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Taxa de entrega</h1>
      <p className="text-stone-600 mb-4">Valor fixo utilizado apenas para pedidos online.</p>
      <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white p-6 shadow-sm max-w-md">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-sm font-medium text-stone-600">Valor (R$)</label>
          <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
