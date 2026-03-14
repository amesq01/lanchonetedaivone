import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { getCategorias, getProdutos, saveProduto, updateProdutoAtivo, updateProdutoQuantidade } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import type { ProdutoWithCategorias } from '../../types/database';
import type { Categoria } from '../../types/database';
import { imagensProduto } from '../../types/database';

function getCategoriaIds(p: ProdutoWithCategorias): string[] {
  const ids = (p.produto_categorias ?? []).map((pc) => pc.categoria_id);
  if (ids.length > 0) return ids;
  return p.categoria_id ? [p.categoria_id] : [];
}

function produtosDaCategoria(produtos: ProdutoWithCategorias[], categoriaId: string): ProdutoWithCategorias[] {
  return produtos.filter((p) => getCategoriaIds(p).includes(categoriaId));
}

export default function AdminProdutos() {
  const queryClient = useQueryClient();
  const produtosQuery = useQuery({
    queryKey: queryKeys.produtos(false),
    queryFn: () => getProdutos(false),
    staleTime: 60 * 1000,
  });
  const categoriasQuery = useQuery({
    queryKey: queryKeys.categorias,
    queryFn: getCategorias,
    staleTime: 60 * 1000,
  });
  const list = produtosQuery.data ?? [];
  const categorias = categoriasQuery.data ?? [];
  const loading = produtosQuery.isLoading || categoriasQuery.isLoading;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProdutoWithCategorias | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ingredientes, setIngredientes] = useState('');
  const [acompanhamentos, setAcompanhamentos] = useState('');
  const [valor, setValor] = useState('');
  const [quantidade, setQuantidade] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [vaiParaCozinha, setVaiParaCozinha] = useState(true);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [imagens, setImagens] = useState<string[]>([]);
  const [emPromocao, setEmPromocao] = useState(false);
  const [valorPromocional, setValorPromocional] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingQuantidade, setEditingQuantidade] = useState<Record<string, string>>({});
  const [savingQuantidadeId, setSavingQuantidadeId] = useState<string | null>(null);

  const { categoriasComProdutos, semCategoria } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (p) =>
            (p.codigo ?? '').toLowerCase().includes(q) ||
            (p.nome ?? '').toLowerCase().includes(q) ||
            (p.descricao ?? '').toLowerCase().includes(q) ||
            (p.ingredientes ?? '').toLowerCase().includes(q)
        )
      : list;
    const promocoesId = categorias.find((c) => c.nome.toUpperCase() === 'PROMOÇÕES')?.id;
    const comProdutos: { categoria: Categoria; produtos: ProdutoWithCategorias[] }[] = [];

    for (const cat of categorias) {
      let prods = produtosDaCategoria(filtered, cat.id);
      if (cat.id === promocoesId) {
        const emPromo = filtered.filter((p) => p.em_promocao === true);
        const ids = new Set(prods.map((p) => p.id));
        for (const p of emPromo) {
          if (!ids.has(p.id)) {
            ids.add(p.id);
            prods = [...prods, p];
          }
        }
      }
      if (prods.length > 0) comProdutos.push({ categoria: cat, produtos: prods });
    }

    const promocoesProdutos = filtered.filter((p) => p.em_promocao === true);
    const temPromocoesCat = !!promocoesId;
    if (promocoesProdutos.length > 0 && !temPromocoesCat) {
      comProdutos.push({
        categoria: { id: 'promocoes-virtual', nome: 'Promoções', ordem: 0, created_at: '' },
        produtos: promocoesProdutos,
      });
    }

    const semCat = filtered.filter((p) => getCategoriaIds(p).length === 0 && !p.em_promocao);
    return { categoriasComProdutos: comProdutos, semCategoria: semCat };
  }, [list, categorias, searchQuery]);

  function toggleAccordion(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleAtivo(p: ProdutoWithCategorias) {
    if (togglingId === p.id) return;
    const novoAtivo = !p.ativo;
    setTogglingId(p.id);
    try {
      await updateProdutoAtivo(p.id, novoAtivo);
      queryClient.invalidateQueries({ queryKey: queryKeys.produtos() });
    } catch {
      // mantém estado atual; poderia mostrar toast
    } finally {
      setTogglingId(null);
    }
  }

  function getQuantidadeDisplay(p: ProdutoWithCategorias): string {
    return editingQuantidade[p.id] !== undefined ? editingQuantidade[p.id] : String(Number(p.quantidade) ?? 0);
  }

  function setQuantidadeEdit(p: ProdutoWithCategorias, value: string) {
    setEditingQuantidade((prev) => ({ ...prev, [p.id]: value }));
  }

  async function commitQuantidade(p: ProdutoWithCategorias) {
    const raw = editingQuantidade[p.id] !== undefined ? editingQuantidade[p.id] : String(Number(p.quantidade) ?? 0);
    const qtd = Math.max(0, Math.floor(parseInt(raw, 10) || 0));
    setEditingQuantidade((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    const current = Number(p.quantidade) ?? 0;
    if (qtd === current) return;
    setSavingQuantidadeId(p.id);
    try {
      await updateProdutoQuantidade(p.id, qtd);
      queryClient.invalidateQueries({ queryKey: queryKeys.produtos() });
    } catch {
      setEditingQuantidade((prev) => ({ ...prev, [p.id]: raw }));
    } finally {
      setSavingQuantidadeId(null);
    }
  }

  function blurQuantidade(p: ProdutoWithCategorias) {
    commitQuantidade(p);
  }

  function keyDownQuantidade(_p: ProdutoWithCategorias, e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  function toggleCategoria(id: string) {
    setCategoriaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function openForm(prod?: ProdutoWithCategorias) {
    if (prod) {
      setEditing(prod);
      setCodigo(prod.codigo);
      setNome(prod.nome ?? '');
      setDescricao(prod.descricao);
      setIngredientes(prod.ingredientes ?? '');
      setAcompanhamentos(prod.acompanhamentos ?? '');
      setValor(String(prod.valor));
      setQuantidade(prod.quantidade);
      setAtivo(prod.ativo);
      setVaiParaCozinha(prod.vai_para_cozinha !== false);
      setCategoriaIds((prod.produto_categorias ?? []).map((pc) => pc.categoria_id));
      setImagens(imagensProduto(prod));
      setEmPromocao(prod.em_promocao === true);
      setValorPromocional(prod.valor_promocional != null ? String(prod.valor_promocional) : '');
    } else {
      setEditing(null);
      setCodigo('');
      setNome('');
      setDescricao('');
      setIngredientes('');
      setAcompanhamentos('');
      setValor('');
      setQuantidade(0);
      setAtivo(true);
      setVaiParaCozinha(true);
      setCategoriaIds([]);
      setImagens([]);
      setEmPromocao(false);
      setValorPromocional('');
    }
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await saveProduto({
        ...(editing?.id && { id: editing.id }),
        codigo,
        nome: nome.trim() || null,
        descricao,
        ingredientes: ingredientes.trim() || null,
        acompanhamentos: acompanhamentos || null,
        valor: Number(valor),
        quantidade,
        ativo,
        imagem_url: imagens.length > 0 ? imagens[0].trim() || null : null,
        imagens: imagens.map((u) => u.trim()).filter(Boolean),
        vai_para_cozinha: vaiParaCozinha,
        em_promocao: emPromocao,
        valor_promocional: emPromocao && valorPromocional.trim() ? Number(valorPromocional) : null,
        categoria_ids: categoriaIds,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.produtos() });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="min-w-0">
      <h1 className="mb-4 text-xl sm:text-2xl font-bold text-stone-800">Produtos</h1>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
            placeholder="Buscar por código, nome, descrição ou ingredientes..."
            className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              setExpandedCats(
                new Set([
                  ...categoriasComProdutos.map((c) => c.categoria.id),
                  ...(semCategoria.length > 0 ? ['sem-categoria'] : []),
                ]),
              )
            }
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Expandir todos
          </button>
          <button
            type="button"
            onClick={() => setExpandedCats(new Set())}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Recolher todos
          </button>
          <button
            onClick={() => openForm()}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm text-white hover:bg-amber-700"
          >
            Novo produto
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {categoriasComProdutos.map(({ categoria, produtos }) => {
          const isOpen = expandedCats.has(categoria.id);
          return (
            <div key={categoria.id} className="overflow-hidden rounded-xl bg-white shadow-sm border border-stone-200">
              <button
                type="button"
                onClick={() => toggleAccordion(categoria.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 text-left font-medium text-stone-800"
              >
                <span className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-5 w-5 text-stone-500" /> : <ChevronRight className="h-5 w-5 text-stone-500" />}
                  {categoria.nome} <span className="text-sm font-normal text-stone-500">({produtos.length})</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-stone-200 overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="border-b border-stone-200 bg-stone-50/80">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Código</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Nome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Descrição</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Valor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Quantidade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Ativo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Foto</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((p) => (
                        <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                          <td className="px-4 py-2 text-sm">{p.codigo}</td>
                          <td className="px-4 py-2 text-sm">{p.nome || '—'}</td>
                          <td className="px-4 py-2 text-sm text-stone-600 max-w-[140px] truncate">{p.descricao}</td>
                          <td className="px-4 py-2 text-sm">
                            {p.em_promocao && p.valor_promocional != null
                              ? <>R$ <span className="line-through text-stone-400">{Number(p.valor).toFixed(2)}</span> → R$ {Number(p.valor_promocional).toFixed(2)}</>
                              : `R$ ${Number(p.valor).toFixed(2)}`}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min={0}
                              value={getQuantidadeDisplay(p)}
                              onChange={(e) => setQuantidadeEdit(p, e.target.value)}
                              onFocus={(e) => (e.target as HTMLInputElement).select()}
                              onBlur={() => blurQuantidade(p)}
                              onKeyDown={(e) => keyDownQuantidade(p, e)}
                              disabled={savingQuantidadeId === p.id}
                              className="w-20 rounded border border-stone-300 px-2 py-1 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-stone-100"
                              aria-label="Quantidade"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={p.ativo}
                              aria-label={p.ativo ? 'Ativo' : 'Inativo'}
                              disabled={togglingId === p.id}
                              onClick={() => toggleAtivo(p)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 ${p.ativo ? 'bg-amber-600' : 'bg-stone-200'}`}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${p.ativo ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            {(imagensProduto(p)[0]) ? <img src={imagensProduto(p)[0]} alt="" className="w-8 h-8 rounded object-cover" /> : <span className="text-stone-400 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => openForm(p)} className="text-amber-600 hover:underline text-sm">Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {semCategoria.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-stone-200">
            <button
              type="button"
              onClick={() => toggleAccordion('sem-categoria')}
              className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 text-left font-medium text-stone-800"
            >
              <span className="flex items-center gap-2">
                {expandedCats.has('sem-categoria') ? <ChevronDown className="h-5 w-5 text-stone-500" /> : <ChevronRight className="h-5 w-5 text-stone-500" />}
                Sem categoria <span className="text-sm font-normal text-stone-500">({semCategoria.length})</span>
              </span>
            </button>
            {expandedCats.has('sem-categoria') && (
              <div className="border-t border-stone-200 overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="border-b border-stone-200 bg-stone-50/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Código</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Descrição</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Valor</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Quantidade</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Ativo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Foto</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {semCategoria.map((p) => (
                      <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-4 py-2 text-sm">{p.codigo}</td>
                        <td className="px-4 py-2 text-sm">{p.nome || '—'}</td>
                        <td className="px-4 py-2 text-sm text-stone-600 max-w-[140px] truncate">{p.descricao}</td>
                        <td className="px-4 py-2 text-sm">
                          {p.em_promocao && p.valor_promocional != null
                            ? <>R$ <span className="line-through text-stone-400">{Number(p.valor).toFixed(2)}</span> → R$ {Number(p.valor_promocional).toFixed(2)}</>
                            : `R$ ${Number(p.valor).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={getQuantidadeDisplay(p)}
                            onChange={(e) => setQuantidadeEdit(p, e.target.value)}
                            onFocus={(e) => (e.target as HTMLInputElement).select()}
                            onBlur={() => blurQuantidade(p)}
                            onKeyDown={(e) => keyDownQuantidade(p, e)}
                            disabled={savingQuantidadeId === p.id}
                            className="w-20 rounded border border-stone-300 px-2 py-1 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-stone-100"
                            aria-label="Quantidade"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.ativo}
                            aria-label={p.ativo ? 'Ativo' : 'Inativo'}
                            disabled={togglingId === p.id}
                            onClick={() => toggleAtivo(p)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 ${p.ativo ? 'bg-amber-600' : 'bg-stone-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${p.ativo ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          {(imagensProduto(p)[0]) ? <img src={imagensProduto(p)[0]} alt="" className="w-8 h-8 rounded object-cover" /> : <span className="text-stone-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={() => openForm(p)} className="text-amber-600 hover:underline text-sm">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {list.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-stone-500 shadow-sm border border-stone-200">Nenhum produto cadastrado.</p>
        )}
        {list.length > 0 && categoriasComProdutos.length === 0 && semCategoria.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-stone-500 shadow-sm border border-stone-200">Nenhum produto encontrado para &quot;{searchQuery}&quot;.</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">{editing ? 'Editar produto' : 'Novo produto'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-600">Código *</label>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Nome do produto</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: X-Burger, Refrigerante 350ml" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Descrição *</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Ingredientes</label>
                <input value={ingredientes} onChange={(e) => setIngredientes(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: Pão, carne, queijo, alface" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Acompanhamentos</label>
                <input value={acompanhamentos} onChange={(e) => setAcompanhamentos(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: Batata, Salada" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Valor (R$) *</label>
                <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="em_promocao" checked={emPromocao} onChange={(e) => setEmPromocao(e.target.checked)} className="rounded border-stone-300" />
                <label htmlFor="em_promocao" className="text-sm font-medium text-stone-600">Na promoção?</label>
              </div>
              {emPromocao && (
                <div>
                  <label className="block text-sm font-medium text-stone-600">Valor promocional (R$) *</label>
                  <input type="number" step="0.01" min="0" value={valorPromocional} onChange={(e) => setValorPromocional(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Preço na promoção" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-stone-600">Quantidade</label>
                <input type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Fotos do produto (URLs)</label>
                <p className="text-xs text-stone-500 mt-0.5">Adicione quantas imagens quiser; a primeira será a miniatura.</p>
                <div className="mt-2 space-y-2">
                  {imagens.map((url, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input type="url" value={url} onChange={(e) => setImagens((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })} className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" placeholder="https://..." />
                      <button type="button" onClick={() => setImagens((prev) => prev.filter((_, j) => j !== i))} className="rounded-lg border border-red-200 px-2 py-2 text-red-600 hover:bg-red-50 text-sm shrink-0" title="Remover">Remover</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setImagens((prev) => [...prev, ''])} className="rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
                    + Adicionar outra imagem
                  </button>
                </div>
                {imagens.some((u) => u.trim()) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {imagens.filter((u) => u.trim()).map((u, i) => (
                      <img key={i} src={u} alt="" className="w-16 h-16 rounded object-cover border border-stone-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded border-stone-300" />
                <label htmlFor="ativo" className="text-sm text-stone-600">Ativo</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">Categorias (loja online)</label>
                <div className="mt-1 flex flex-wrap gap-2 rounded-lg border border-stone-300 p-2 max-h-32 overflow-y-auto">
                  {categorias.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={categoriaIds.includes(c.id)} onChange={() => toggleCategoria(c.id)} className="rounded border-stone-300" />
                      <span>{c.nome}</span>
                    </label>
                  ))}
                  {categorias.length === 0 && <span className="text-stone-400 text-sm">Nenhuma categoria cadastrada.</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="vai_para_cozinha" checked={vaiParaCozinha} onChange={(e) => setVaiParaCozinha(e.target.checked)} className="rounded border-stone-300" />
                <label htmlFor="vai_para_cozinha" className="text-sm text-stone-600">Vai para cozinha (preparo)</label>
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
