import { useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getCategorias, getProdutos, saveProduto } from '../../lib/api';
import type { ProdutoWithCategorias } from '../../types/database';
import type { Categoria } from '../../types/database';

function getCategoriaIds(p: ProdutoWithCategorias): string[] {
  const ids = (p.produto_categorias ?? []).map((pc) => pc.categoria_id);
  if (ids.length > 0) return ids;
  return p.categoria_id ? [p.categoria_id] : [];
}

function produtosDaCategoria(produtos: ProdutoWithCategorias[], categoriaId: string): ProdutoWithCategorias[] {
  return produtos.filter((p) => getCategoriaIds(p).includes(categoriaId));
}

export default function AdminProdutos() {
  const [list, setList] = useState<ProdutoWithCategorias[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [imagemUrl, setImagemUrl] = useState('');
  const [emPromocao, setEmPromocao] = useState(false);
  const [valorPromocional, setValorPromocional] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const { categoriasComProdutos, semCategoria } = useMemo(() => {
    const promocoesId = categorias.find((c) => c.nome.toUpperCase() === 'PROMOÇÕES')?.id;
    const comProdutos: { categoria: Categoria; produtos: ProdutoWithCategorias[] }[] = [];

    for (const cat of categorias) {
      let prods = produtosDaCategoria(list, cat.id);
      if (cat.id === promocoesId) {
        const emPromo = list.filter((p) => p.em_promocao === true);
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

    const promocoesProdutos = list.filter((p) => p.em_promocao === true);
    const temPromocoesCat = !!promocoesId;
    if (promocoesProdutos.length > 0 && !temPromocoesCat) {
      comProdutos.push({
        categoria: { id: 'promocoes-virtual', nome: 'Promoções', ordem: 0, created_at: '' },
        produtos: promocoesProdutos,
      });
    }

    const semCat = list.filter((p) => getCategoriaIds(p).length === 0 && !p.em_promocao);
    return { categoriasComProdutos: comProdutos, semCategoria: semCat };
  }, [list, categorias]);

  function toggleAccordion(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    load();
    getCategorias().then(setCategorias);
  }, []);

  async function load() {
    const data = await getProdutos(false);
    setList(data);
    setLoading(false);
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
      setImagemUrl(prod.imagem_url ?? '');
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
      setImagemUrl('');
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
        imagem_url: imagemUrl.trim() || null,
        vai_para_cozinha: vaiParaCozinha,
        em_promocao: emPromocao,
        valor_promocional: emPromocao && valorPromocional.trim() ? Number(valorPromocional) : null,
        categoria_ids: categoriaIds,
      });
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpandedCats(new Set([...categoriasComProdutos.map((c) => c.categoria.id), ...(semCategoria.length > 0 ? ['sem-categoria'] : [])]))}
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
          <button onClick={() => openForm()} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
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
                <div className="border-t border-stone-200">
                  <table className="w-full">
                    <thead className="border-b border-stone-200 bg-stone-50/80">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Código</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Nome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Descrição</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Valor</th>
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
                          <td className="px-4 py-2 text-sm text-stone-600 max-w-[200px] truncate">{p.descricao}</td>
                          <td className="px-4 py-2 text-sm">
                            {p.em_promocao && p.valor_promocional != null
                              ? <>R$ <span className="line-through text-stone-400">{Number(p.valor).toFixed(2)}</span> → R$ {Number(p.valor_promocional).toFixed(2)}</>
                              : `R$ ${Number(p.valor).toFixed(2)}`}
                          </td>
                          <td className="px-4 py-2 text-sm">{p.ativo ? 'Sim' : 'Não'}</td>
                          <td className="px-4 py-2">
                            {p.imagem_url ? <img src={p.imagem_url} alt="" className="w-8 h-8 rounded object-cover" /> : <span className="text-stone-400 text-xs">—</span>}
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
              <div className="border-t border-stone-200">
                <table className="w-full">
                  <thead className="border-b border-stone-200 bg-stone-50/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Código</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Descrição</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Valor</th>
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
                        <td className="px-4 py-2 text-sm text-stone-600 max-w-[200px] truncate">{p.descricao}</td>
                        <td className="px-4 py-2 text-sm">
                          {p.em_promocao && p.valor_promocional != null
                            ? <>R$ <span className="line-through text-stone-400">{Number(p.valor).toFixed(2)}</span> → R$ {Number(p.valor_promocional).toFixed(2)}</>
                            : `R$ ${Number(p.valor).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2 text-sm">{p.ativo ? 'Sim' : 'Não'}</td>
                        <td className="px-4 py-2">
                          {p.imagem_url ? <img src={p.imagem_url} alt="" className="w-8 h-8 rounded object-cover" /> : <span className="text-stone-400 text-xs">—</span>}
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
                <label className="block text-sm font-medium text-stone-600">URL da foto do produto</label>
                <input type="url" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="https://..." />
                {imagemUrl && <img src={imagemUrl} alt="Preview" className="mt-2 w-20 h-20 rounded object-cover border border-stone-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
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
