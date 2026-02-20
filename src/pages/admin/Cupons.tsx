import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { reporUsosCupom } from '../../lib/api';
import type { Cupom } from '../../types/database';

export default function AdminCupons() {
  const [list, setList] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cupom | null>(null);
  const [codigo, setCodigo] = useState('');
  const [porcentagem, setPorcentagem] = useState('');
  const [validoAte, setValidoAte] = useState('');
  const [quantidadeUsos, setQuantidadeUsos] = useState('1');
  const [usosRestantes, setUsosRestantes] = useState('1');
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

  function openForm(c?: Cupom) {
    if (c) {
      setEditing(c);
      setCodigo(c.codigo);
      setPorcentagem(String(c.porcentagem));
      setValidoAte(new Date(c.valido_ate).toISOString().slice(0, 10));
      setQuantidadeUsos(String(c.quantidade_usos));
      setUsosRestantes(String(c.usos_restantes));
      setAtivo(c.ativo);
    } else {
      setEditing(null);
      setCodigo('');
      setPorcentagem('');
      setValidoAte('');
      setQuantidadeUsos('1');
      setUsosRestantes('1');
      setAtivo(true);
    }
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const q = Math.max(1, parseInt(quantidadeUsos, 10) || 1);
      const restantes = editing ? Math.max(0, parseInt(usosRestantes, 10) || 0) : q;
      if (editing) {
        await supabase.from('cupons').update({
          porcentagem: Number(porcentagem),
          valido_ate: validoAte,
          quantidade_usos: q,
          usos_restantes: Math.min(restantes, q),
          ativo,
        }).eq('id', editing.id);
      } else {
        await supabase.from('cupons').insert({
          codigo: codigo.trim(),
          porcentagem: Number(porcentagem),
          valido_ate: validoAte,
          quantidade_usos: q,
          usos_restantes: q,
          ativo,
        });
      }
      setOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReporUsos(c: Cupom) {
    await reporUsosCupom(c.id);
    load();
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Cupons de desconto</h1>
        <button onClick={() => openForm()} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
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
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Usos restantes</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Ativo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-stone-100">
                <td className="px-4 py-3 font-medium">{c.codigo}</td>
                <td className="px-4 py-3">{Number(c.porcentagem)}%</td>
                <td className="px-4 py-3">{new Date(c.valido_ate).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <span className={c.usos_restantes <= 0 ? 'text-red-600 font-medium' : ''}>
                    {c.usos_restantes} / {c.quantidade_usos}
                  </span>
                </td>
                <td className="px-4 py-3">{c.ativo ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openForm(c)} className="text-amber-600 hover:underline text-sm">Editar</button>
                  <button onClick={() => handleReporUsos(c)} className="text-stone-600 hover:underline text-sm">Repor usos</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">{editing ? 'Editar cupom' : 'Novo cupom'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-600">Código *</label>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required disabled={!!editing} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 disabled:bg-stone-100" />
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
                <label className="block text-sm font-medium text-stone-600">Quantidade total de usos *</label>
                <input type="number" min="1" value={quantidadeUsos} onChange={(e) => setQuantidadeUsos(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              {editing && (
                <div>
                  <label className="block text-sm font-medium text-stone-600">Usos restantes (para edição)</label>
                  <input type="number" min="0" value={usosRestantes} onChange={(e) => setUsosRestantes(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
                  <p className="mt-0.5 text-xs text-stone-500">Ajuste para permitir uso do cupom. Não pode ser maior que a quantidade total.</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded border-stone-300" />
                <label htmlFor="ativo" className="text-sm text-stone-600">Ativo</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                  {submitting ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar'}
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
