import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Produto } from '../../types/database';

export default function AdminProdutos() {
  const [list, setList] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [acompanhamentos, setAcompanhamentos] = useState('');
  const [valor, setValor] = useState('');
  const [quantidade, setQuantidade] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from('produtos').select('*').order('codigo');
    setList((data ?? []) as Produto[]);
    setLoading(false);
  }

  function openForm(prod?: Produto) {
    if (prod) {
      setEditing(prod);
      setCodigo(prod.codigo);
      setDescricao(prod.descricao);
      setAcompanhamentos(prod.acompanhamentos ?? '');
      setValor(String(prod.valor));
      setQuantidade(prod.quantidade);
      setAtivo(prod.ativo);
    } else {
      setEditing(null);
      setCodigo('');
      setDescricao('');
      setAcompanhamentos('');
      setValor('');
      setQuantidade(0);
      setAtivo(true);
    }
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        codigo,
        descricao,
        acompanhamentos: acompanhamentos || null,
        valor: Number(valor),
        quantidade,
        ativo,
        updated_at: new Date().toISOString(),
      };
      if (editing) await supabase.from('produtos').update(payload).eq('id', editing.id);
      else await supabase.from('produtos').insert(payload);
      setOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Produtos</h1>
        <button onClick={() => openForm()} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
          Novo produto
        </button>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Descrição</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Acompanhamentos</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Valor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Qtd</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Ativo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="px-4 py-3">{p.codigo}</td>
                <td className="px-4 py-3">{p.descricao}</td>
                <td className="px-4 py-3 text-sm text-stone-500">{p.acompanhamentos ?? '-'}</td>
                <td className="px-4 py-3">R$ {Number(p.valor).toFixed(2)}</td>
                <td className="px-4 py-3">{p.quantidade}</td>
                <td className="px-4 py-3">{p.ativo ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openForm(p)} className="text-amber-600 hover:underline text-sm">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">{editing ? 'Editar produto' : 'Novo produto'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-600">Código *</label>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required disabled={!!editing} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 disabled:bg-stone-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Descrição *</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Acompanhamentos</label>
                <input value={acompanhamentos} onChange={(e) => setAcompanhamentos(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: Batata, Salada" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Valor (R$) *</label>
                <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Quantidade</label>
                <input type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
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
