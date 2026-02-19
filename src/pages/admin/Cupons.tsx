import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Cupom } from '../../types/database';

export default function AdminCupons() {
  const [list, setList] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [porcentagem, setPorcentagem] = useState('');
  const [validoAte, setValidoAte] = useState('');
  const [quantidadeUsos, setQuantidadeUsos] = useState('1');
  const [ativo, setAtivo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from('cupons').select('*').order('created_at', { ascending: false });
    setList((data ?? []) as Cupom[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
    const q = parseInt(quantidadeUsos, 10) || 1;
      await supabase.from('cupons').insert({
        codigo,
        porcentagem: Number(porcentagem),
        valido_ate: validoAte,
        quantidade_usos: q,
        usos_restantes: q,
        ativo,
      });
      setOpen(false);
      setCodigo('');
      setPorcentagem('');
      setValidoAte('');
      setQuantidadeUsos('1');
      setAtivo(true);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Cupons de desconto</h1>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
          Novo cupom
        </button>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Desconto %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Válido até</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Usos</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-stone-100">
                <td className="px-4 py-3 font-medium">{c.codigo}</td>
                <td className="px-4 py-3">{Number(c.porcentagem)}%</td>
                <td className="px-4 py-3">{new Date(c.valido_ate).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">{c.usos_restantes} / {c.quantidade_usos}</td>
                <td className="px-4 py-3">{c.ativo ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Novo cupom</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-600">Código *</label>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Porcentagem de desconto *</label>
                <input type="number" min="0" max="100" step="0.01" value={porcentagem} onChange={(e) => setPorcentagem(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Válido até *</label>
                <input type="date" value={validoAte} onChange={(e) => setValidoAte(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Quantidade de usos *</label>
                <input type="number" min="1" value={quantidadeUsos} onChange={(e) => setQuantidadeUsos(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded border-stone-300" />
                <label htmlFor="ativo" className="text-sm text-stone-600">Ativo</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                  {submitting ? 'Salvando...' : 'Cadastrar'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600 hover:bg-stone-50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
