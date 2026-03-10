import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { formatarTelefone } from '../../lib/mascaraTelefone';

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
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

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
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.access_token) {
        setError('Sessão expirada. Faça login novamente e tente cadastrar o atendente.');
        return;
      }
      const token = session.access_token.trim();
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
        let errMsg = msg || `Erro ${res.status}. Verifique se a Edge Function create-atendente está publicada no Supabase.`;
        if ((msg || '').toLowerCase().includes('invalid jwt') || (msg || '').toLowerCase().includes('jwt')) {
          errMsg = 'Token inválido ou expirado. Faça logout, entre novamente como admin e tente de novo. Se persistir, execute: supabase functions deploy create-atendente (o config.toml já define verify_jwt = false).';
        }
        setError(errMsg);
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

  function abrirEdicao(p: Profile) {
    setEditing(p);
    setEditCodigo(p.codigo ?? '');
    setEditNome(p.nome ?? '');
    setEditTelefone(formatarTelefone(p.telefone ?? ''));
    setError('');
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setError('');
    try {
      const { error: upError } = await (supabase as any)
        .from('profiles')
        .update({
          codigo: editCodigo.trim() || null,
          nome: editNome.trim() || editing.nome,
          telefone: editTelefone.trim() || null,
        })
        .eq('id', editing.id);
      if (upError) {
        setError(upError.message || 'Erro ao salvar edição.');
        return;
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar edição.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingLoading(true);
    setError('');
    try {
      const { error: delError } = await supabase.from('profiles').delete().eq('id', deleting.id);
      if (delError) {
        setError(delError.message || 'Erro ao excluir atendente.');
        return;
      }
      setDeleting(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir atendente.');
    } finally {
      setDeletingLoading(false);
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
              <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="px-4 py-3">{p.codigo ?? '-'}</td>
                <td className="px-4 py-3">{p.nome}</td>
                <td className="px-4 py-3">{p.email}</td>
                <td className="px-4 py-3">{p.telefone ?? '-'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(p)}
                    className="rounded-lg border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </td>
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
                <input type="tel" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="(11) 99999-9999" />
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
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Editar atendente</h2>
            <form onSubmit={handleSalvarEdicao} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-600">Código</label>
                <input
                  value={editCodigo}
                  onChange={(e) => setEditCodigo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Nome *</label>
                <input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Email</label>
                <input
                  value={editing.email}
                  disabled
                  className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-stone-500"
                />
                <p className="mt-1 text-xs text-stone-500">
                  O email de login é gerenciado pelo Supabase Auth; se precisar alterar, crie um novo atendente.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Telefone</label>
                <input
                  type="tel"
                  value={editTelefone}
                  onChange={(e) => setEditTelefone(formatarTelefone(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                  placeholder="(11) 99999-9999"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600 hover:bg-stone-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-2">Excluir atendente</h2>
            <p className="text-sm text-stone-600 mb-4">
              Tem certeza que deseja excluir o atendente <strong>{deleting.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deletingLoading}
                className="flex-1 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingLoading ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setDeleting(null)}
                disabled={deletingLoading}
                className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600 hover:bg-stone-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
