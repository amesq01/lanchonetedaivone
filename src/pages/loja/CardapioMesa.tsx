import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getProdutos, getCategorias } from '../../lib/api';
import type { ProdutoWithCategorias } from '../../types/database';
import type { Categoria } from '../../types/database';
import { precoVenda } from '../../types/database';

function CardapioLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <p className="text-stone-600">Carregando cardápio...</p>
    </div>
  );
}

function getCategoriaPorNome(categorias: Categoria[], ...nomes: string[]): Categoria | undefined {
  const uppers = nomes.map((n) => n.toUpperCase());
  return categorias.find((c) => {
    const cn = c.nome.toUpperCase();
    return uppers.some((u) => cn === u || cn.includes(u) || u.includes(cn));
  });
}

function getCategoriaIds(p: ProdutoWithCategorias): string[] {
  const ids = (p.produto_categorias ?? []).map((pc) => pc.categoria_id);
  if (ids.length > 0) return ids;
  return p.categoria_id ? [p.categoria_id] : [];
}

function produtosDaCategoria(produtos: ProdutoWithCategorias[], categoriaId: string): ProdutoWithCategorias[] {
  return produtos.filter((p) => getCategoriaIds(p).includes(categoriaId));
}

function CardItem({ produto }: { produto: ProdutoWithCategorias }) {
  const valor = precoVenda(produto);
  const emPromo = produto.em_promocao && produto.valor_promocional != null && Number(produto.valor_promocional) > 0;
  return (
    <article className="cardapio-item rounded-xl border border-stone-200 bg-white p-2 shadow-sm print:shadow-none print:border-stone-300 print:p-3">
      <div className="flex gap-4 print:gap-3">
        <div className="cardapio-item-img h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100 print:h-20 print:w-20 print:rounded">
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt=""
              className="h-full w-full object-cover print:object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-400 text-xs print:text-[10px]">Sem imagem</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold text-stone-800 print:text-sm print:font-bold">{produto.nome || produto.descricao}</h3>
            <span className="text-xs text-stone-500 print:text-[10px]">Cód: {produto.codigo}</span>
          </div>
          {produto.nome && produto.descricao && <p className="mt-0.5 text-sm text-stone-600 print:text-xs print:mt-0">{produto.descricao}</p>}
          {produto.ingredientes && (
            <p className="mt-3 text-xs text-stone-500 print:mt-1 print:text-[10px]">
              <span className="font-medium text-stone-600">Ingredientes:</span> {produto.ingredientes}
            </p>
          )}
          {produto.acompanhamentos && (
            <p className="mt-1 text-xs text-stone-500 print:text-[10px]">
              <span className="font-medium text-stone-600">Acompanhamentos:</span> {produto.acompanhamentos}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 self-center font-semibold text-amber-600 print:text-sm">
          {emPromo ? (
            <>
              <span className="text-stone-400 line-through font-normal mr-1">R$ {Number(produto.valor).toFixed(2)}</span>
              R$ {valor.toFixed(2)}
            </>
          ) : (
            <>R$ {valor.toFixed(2)}</>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CardapioMesa() {
  const [produtos, setProdutos] = useState<ProdutoWithCategorias[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  function handleImprimir() {
    const imagens = document.querySelectorAll('.print-cardapio-a4 img[src]');
    const promessas = Array.from(imagens).map((img) => {
      const el = img as HTMLImageElement;
      if (el.complete && el.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        el.onload = () => resolve();
        el.onerror = () => resolve();
        setTimeout(resolve, 2000);
      });
    });
    Promise.all(promessas).then(() => window.print());
  }

  useEffect(() => {
    setErro(null);
    setLoading(true);
    Promise.all([getCategorias(), getProdutos(true)])
      .then(([cats, list]) => {
        setCategorias(cats);
        setProdutos(list);
      })
      .catch((e) => {
        setErro(e?.message ?? 'Não foi possível carregar o cardápio.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <CardapioLoading />;

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-center text-stone-600">{erro}</p>
      </div>
    );
  }

  const catSushi = getCategoriaPorNome(categorias, 'Sushi', 'Sushis');
  const catLanches = getCategoriaPorNome(categorias, 'Lanche', 'Lanches');
  const catBebidas = getCategoriaPorNome(categorias, 'Bebida', 'Bebidas');
  const promocoesId = categorias.find((c) => c.nome.toUpperCase() === 'PROMOÇÕES')?.id;

  const idsJaExibidos = new Set<string>();
  const produtosSushi = catSushi ? produtosDaCategoria(produtos, catSushi.id).filter((p) => {
    if (idsJaExibidos.has(p.id)) return false;
    idsJaExibidos.add(p.id);
    return true;
  }) : [];
  const produtosLanches = catLanches ? produtosDaCategoria(produtos, catLanches.id).filter((p) => {
    if (idsJaExibidos.has(p.id)) return false;
    idsJaExibidos.add(p.id);
    return true;
  }) : [];
  const produtosBebidas = catBebidas ? produtosDaCategoria(produtos, catBebidas.id).filter((p) => {
    if (idsJaExibidos.has(p.id)) return false;
    idsJaExibidos.add(p.id);
    return true;
  }) : [];

  const categoriasExibidas = new Set<string>([
    ...(catSushi ? [catSushi.id] : []),
    ...(catLanches ? [catLanches.id] : []),
    ...(catBebidas ? [catBebidas.id] : []),
    ...(promocoesId ? [promocoesId] : []),
  ]);
  const outrasCategorias = categorias.filter((c) => !categoriasExibidas.has(c.id));
  const idsSemPromocao = (p: ProdutoWithCategorias) =>
    getCategoriaIds(p).filter((id) => !promocoesId || id !== promocoesId);
  const produtosSemCategoria = produtos.filter((p) => idsSemPromocao(p).length === 0);
  const produtosDeOutraCat = (catId: string) =>
    produtosDaCategoria(produtos, catId).filter((p) => {
      if (idsJaExibidos.has(p.id)) return false;
      idsJaExibidos.add(p.id);
      return true;
    });

  return (
    <div className="print-cardapio-a4 min-h-screen bg-stone-50">
      <header className="cardapio-header border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Lanchonete Terra e Mar</h1>
            <p className="mt-1 text-sm text-stone-500">Cardápio da mesa</p>
          </div>
          <button
            type="button"
            onClick={handleImprimir}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700"
          >
            <Printer className="h-5 w-5" />
            Imprimir
          </button>
        </div>
      </header>
      <table className="cardapio-print-table w-full max-w-6xl mx-auto border-collapse">
        <thead className="hidden print:table-header-group">
          <tr>
            <td className="print:py-3 print:border-b-2 print:border-stone-800 print:text-center print:align-top">
              <h1 className="text-2xl font-bold text-stone-800 print:text-lg print:font-bold">Lanchonete Terra e Mar</h1>
              <p className="text-sm text-stone-500 print:text-xs print:mt-0.5">Cardápio da mesa</p>
            </td>
          </tr>
        </thead>
        <tbody className="print:table-row-group">
        {/* Categorias uma abaixo da outra */}
        {catSushi && produtosSushi.length > 0 && (
          <>
            <tr className="cardapio-section-row"><td className="pt-4 pb-2 print:pt-4 print:pb-2"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{catSushi.nome}</h2></td></tr>
            {produtosSushi.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        {catLanches && produtosLanches.length > 0 && (
          <>
            <tr className="cardapio-section-row"><td className="pt-4 pb-2 print:pt-4 print:pb-2"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{catLanches.nome}</h2></td></tr>
            {produtosLanches.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        {catBebidas && produtosBebidas.length > 0 && (
          <>
            <tr className="cardapio-section-row"><td className="pt-4 pb-2 print:pt-4 print:pb-2"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{catBebidas.nome}</h2></td></tr>
            {produtosBebidas.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        {outrasCategorias.map((cat) => {
          const prods = produtosDeOutraCat(cat.id);
          if (prods.length === 0) return null;
          return (
            <React.Fragment key={cat.id}>
              <tr className="cardapio-section-row"><td className="pt-4 pb-2 print:pt-4 print:pb-2"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{cat.nome}</h2></td></tr>
              {prods.map((p) => (
                <tr key={p.id}><td className="py-1 print:py-1"><CardItem produto={p} /></td></tr>
              ))}
            </React.Fragment>
          );
        })}
        {produtosSemCategoria.length > 0 && (
          <>
            <tr className="cardapio-section-row"><td className="pt-4 pb-2 print:pt-4 print:pb-2"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">Cardápio</h2></td></tr>
            {produtosSemCategoria.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        </tbody>
      </table>
      {produtos.length === 0 && <p className="mx-auto max-w-6xl px-4 py-6 text-stone-500">Nenhum produto disponível.</p>}
    </div>
  );
}
