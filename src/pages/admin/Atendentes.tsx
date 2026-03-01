import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';

export default function AdminAtendentes() {
  const [list, setList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'atendente').order('nome');
    setList((data ?? []) as Profile[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL ?? '';
      if (!url) {
        setError('VITE_SUPABASE_URL não está configurado no .env.');
        return;
      }
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      const token = (refreshedSession?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token)?.trim();
      if (!token) {
        setError('Sessão expirada. Faça login novamente.');
        return;
      }
      const res = await fetch(`${url}/functions/v1/create-atendente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, password: senha, nome, codigo, telefone }),
      });
      let msg = '';
      try {
        const json = await res.json();
        msg = json.error || json.message || '';
      } catch {
        msg = res.statusText || `Erro ${res.status}`;
      }
      if (!res.ok) {
        setError(msg || `Erro ${res.status}. Verifique se a Edge Function create-atendente está publicada no Supabase.`);
        return;
      }
      setOpen(false);
      setNome('');
      setCodigo('');
      setEmail('');
      setTelefone('');
      setSenha('');
      load();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Atendentes</h1>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
          Novo atendente
        </button>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Nome</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Telefone</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="px-4 py-3">{p.codigo ?? '-'}</td>
                <td className="px-4 py-3">{p.nome}</td>
                <td className="px-4 py-3">{p.email}</td>
                <td className="px-4 py-3">{p.telefone ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Cadastrar atendente</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-600">Código</label>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Nome *</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Telefone</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Senha *</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
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
