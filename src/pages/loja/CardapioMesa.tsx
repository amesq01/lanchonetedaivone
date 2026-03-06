import React, { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
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

function ModalProdutoCardapio({ produto, onClose }: { produto: ProdutoWithCategorias; onClose: () => void }) {
  const valor = precoVenda(produto);
  const emPromo = produto.em_promocao && produto.valor_promocional != null && Number(produto.valor_promocional) > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:hidden" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-cardapio-titulo">
      <div className="bg-white rounded-2xl shadow-xl max-w-[420px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-shrink-0">
          <button type="button" onClick={onClose} className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-600 hover:text-stone-800" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
          <div className="aspect-square w-full max-h-72 bg-stone-100 flex items-center justify-center text-stone-400 overflow-hidden">
            {produto.imagem_url ? <img src={produto.imagem_url} alt="" className="w-full h-full object-contain object-center" /> : 'Sem imagem'}
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <h2 id="modal-cardapio-titulo" className="text-xl font-semibold text-stone-800">{produto.nome || produto.descricao}</h2>
          <p className="mt-1 text-sm text-stone-500">Cód: #{produto.codigo}</p>
          {produto.nome && produto.descricao && <p className="mt-1 text-stone-600">{produto.descricao}</p>}
          {produto.ingredientes && (
            <p className="mt-3 text-sm text-stone-600"><span className="font-medium text-stone-700">Ingredientes:</span> {produto.ingredientes}</p>
          )}
          {produto.acompanhamentos && (
            <p className="mt-1 text-sm text-stone-600"><span className="font-medium text-stone-700">Acompanhamentos:</span> {produto.acompanhamentos}</p>
          )}
          <div className="mt-4 font-semibold text-amber-600">
            {emPromo ? (
              <>
                <span className="text-stone-400 line-through font-normal mr-1">R$ {Number(produto.valor).toFixed(2)}</span>
                R$ {Number(produto.valor_promocional).toFixed(2)}
              </>
            ) : (
              <>R$ {valor.toFixed(2)}</>
            )}
          </div>
          <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-stone-200 py-3 px-4 text-stone-700 font-semibold hover:bg-stone-300">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function CardItem({ produto, onClick }: { produto: ProdutoWithCategorias; onClick?: () => void }) {
  const valor = precoVenda(produto);
  const emPromo = produto.em_promocao && produto.valor_promocional != null && Number(produto.valor_promocional) > 0;
  const isClickable = !!onClick;
  return (
    <article
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={`cardapio-item rounded-xl border border-stone-200 bg-white p-1.5 sm:p-2 shadow-sm print:shadow-none print:border-stone-300 print:p-3 w-full min-w-0 ${isClickable ? 'cursor-pointer hover:border-amber-200 hover:shadow-md transition print:cursor-default' : ''}`}
    >
      <div className="flex gap-2 sm:gap-4 print:gap-3 min-w-0">
        <div className="cardapio-item-img h-16 w-16 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100 print:h-20 print:w-20 print:rounded">
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
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="block text-xs text-stone-500 print:text-[10px] truncate">Cód: #{produto.codigo}</span>
          <h3 className="mt-0.5 font-semibold text-stone-800 print:text-sm print:font-bold truncate">{produto.nome || produto.descricao}</h3>
          {produto.nome && produto.descricao && <p className="mt-0.5 text-sm text-stone-600 print:text-xs print:mt-0 truncate">{produto.descricao}</p>}
          <div className="mt-1 font-semibold text-amber-600 print:text-sm truncate">
            {emPromo ? (
              <>
                <span className="text-stone-400 line-through font-normal mr-1">R$ {Number(produto.valor).toFixed(2)}</span>
                R$ {valor.toFixed(2)}
              </>
            ) : (
              <>R$ {valor.toFixed(2)}</>
            )}
          </div>
          {produto.ingredientes && (
            <p className="mt-3 text-xs text-stone-500 print:mt-1 print:text-[10px] hidden sm:block print:block">
              <span className="font-medium text-stone-600">Ingredientes:</span> {produto.ingredientes}
            </p>
          )}
          {produto.acompanhamentos && (
            <p className="mt-1 text-xs text-stone-500 print:text-[10px] hidden sm:block print:block">
              <span className="font-medium text-stone-600">Acompanhamentos:</span> {produto.acompanhamentos}
            </p>
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
  const [modalProduto, setModalProduto] = useState<ProdutoWithCategorias | null>(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);

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

  const promocoesId = categorias.find((c) => c.nome.toUpperCase() === 'PROMOÇÕES')?.id ?? null;

  const byCategoria = (categoriaId: string | null): ProdutoWithCategorias[] => {
    if (categoriaId === promocoesId) {
      return produtos.filter((p) => p.em_promocao === true);
    }
    return produtos.filter((p) => {
      const ids = getCategoriaIds(p);
      if (categoriaId === null) return ids.length === 0;
      return ids.includes(categoriaId);
    });
  };

  const categoriasComProdutos = categorias.filter((c) => {
    if (c.nome.toUpperCase() === 'PROMOÇÕES') return produtos.some((p) => p.em_promocao === true);
    return byCategoria(c.id).length > 0;
  });
  const produtosSemCategoriaLista = byCategoria(null).filter((p) => !p.em_promocao);
  const semCategoria = produtosSemCategoriaLista.length > 0;

  const exibirSemCategoria = categoriaSelecionada === null && semCategoria;
  const exibirCategoria = (cat: Categoria) =>
    categoriaSelecionada === cat.id || (categoriaSelecionada === null && cat.nome.toUpperCase() !== 'PROMOÇÕES');
  const categoriaVazia = categoriaSelecionada !== null && byCategoria(categoriaSelecionada).length === 0;

  const idsJaExibidos = new Set<string>();
  const produtosDeOutraCat = (catId: string) =>
    produtosDaCategoria(produtos, catId).filter((p) => {
      if (idsJaExibidos.has(p.id)) return false;
      idsJaExibidos.add(p.id);
      return true;
    });

  const catSushi = getCategoriaPorNome(categorias, 'Sushi', 'Sushis');
  const catLanches = getCategoriaPorNome(categorias, 'Lanche', 'Lanches');
  const catBebidas = getCategoriaPorNome(categorias, 'Bebida', 'Bebidas');
  const categoriasExibidas = new Set<string>([
    ...(catSushi ? [catSushi.id] : []),
    ...(catLanches ? [catLanches.id] : []),
    ...(catBebidas ? [catBebidas.id] : []),
    ...(promocoesId ? [promocoesId] : []),
  ]);
  const outrasCategorias = categorias.filter((c) => !categoriasExibidas.has(c.id));
  const produtosSushi = catSushi ? produtosDeOutraCat(catSushi.id) : [];
  const produtosLanches = catLanches ? produtosDeOutraCat(catLanches.id) : [];
  const produtosBebidas = catBebidas ? produtosDeOutraCat(catBebidas.id) : [];
  const produtosSemCategoria = produtosSemCategoriaLista;

  return (
    <div className="print-cardapio-a4 min-h-screen bg-stone-50">
      <header className="cardapio-header border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-center sm:justify-between">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-stone-800">Lanchonete Terra e Mar</h1>
              <p className="mt-1 text-sm text-stone-500">Cardápio da mesa</p>
            </div>
            <button
              type="button"
              onClick={handleImprimir}
              className="hidden sm:flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700"
            >
              <Printer className="h-5 w-5" />
              Imprimir
            </button>
          </div>
          <nav className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3 print:hidden">
            <button
              type="button"
              onClick={() => setCategoriaSelecionada(null)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${categoriaSelecionada === null ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              Todos
            </button>
            {categoriasComProdutos.map((cat) => {
              const isPromocoes = cat.nome.toUpperCase() === 'PROMOÇÕES';
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaSelecionada(cat.id)}
                  className={
                    isPromocoes
                      ? `rounded-full px-3 py-1.5 text-sm font-semibold transition shadow-md ${categoriaSelecionada === cat.id
                        ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white ring-2 ring-amber-300 ring-offset-2'
                        : 'bg-gradient-to-r from-red-400 to-amber-400 text-white hover:from-red-500 hover:to-amber-500 hover:shadow-lg'}`
                      : `rounded-full px-3 py-1.5 text-sm font-medium transition ${categoriaSelecionada === cat.id ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`
                  }
                >
                  {isPromocoes && <span className="mr-1" aria-hidden>🔥</span>}
                  {cat.nome}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Tela: lista filtrada por categoria, mesma disposição dos cards (um por linha) */}
      <main className="mx-auto max-w-6xl px-4 py-6 print:hidden">
        {exibirSemCategoria && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">Cardápio</h2>
            <div className="space-y-2">
              {produtosSemCategoria.map((p) => (
                <CardItem key={p.id} produto={p} onClick={() => setModalProduto(p)} />
              ))}
            </div>
          </section>
        )}
        {categoriasComProdutos.filter(exibirCategoria).map((cat) => (
          <section key={cat.id} className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">{cat.nome}</h2>
            <div className="space-y-2">
              {byCategoria(cat.id).map((p) => (
                <CardItem key={p.id} produto={p} onClick={() => setModalProduto(p)} />
              ))}
            </div>
          </section>
        ))}
        {categoriaVazia && <p className="text-stone-500">Nenhum produto nesta categoria.</p>}
        {produtos.length === 0 && <p className="text-stone-500">Nenhum produto disponível.</p>}
      </main>

      {/* Impressão: tabela completa, sem filtro */}
      <div className="hidden print:block px-1.5 sm:px-4 print:px-0 overflow-x-auto print:overflow-visible">
      <table className="cardapio-print-table w-full max-w-6xl mx-auto border-collapse table-fixed sm:table-auto">
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
            <tr className="cardapio-section-row bg-amber-50/80 print:bg-transparent"><td className="pt-4 pb-2 pl-2 sm:pl-4 print:pt-4 print:pb-2 print:pl-0 border-l-4 border-amber-500 print:border-l-0"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{catSushi.nome}</h2></td></tr>
            {produtosSushi.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1 overflow-hidden"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        {catLanches && produtosLanches.length > 0 && (
          <>
            <tr className="cardapio-section-row bg-amber-50/80 print:bg-transparent"><td className="pt-4 pb-2 pl-2 sm:pl-4 print:pt-4 print:pb-2 print:pl-0 border-l-4 border-amber-500 print:border-l-0"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{catLanches.nome}</h2></td></tr>
            {produtosLanches.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1 overflow-hidden"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        {catBebidas && produtosBebidas.length > 0 && (
          <>
            <tr className="cardapio-section-row bg-amber-50/80 print:bg-transparent"><td className="pt-4 pb-2 pl-2 sm:pl-4 print:pt-4 print:pb-2 print:pl-0 border-l-4 border-amber-500 print:border-l-0"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{catBebidas.nome}</h2></td></tr>
            {produtosBebidas.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1 overflow-hidden"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        {outrasCategorias.map((cat) => {
          const prods = produtosDeOutraCat(cat.id);
          if (prods.length === 0) return null;
          return (
            <React.Fragment key={cat.id}>
              <tr className="cardapio-section-row bg-amber-50/80 print:bg-transparent"><td className="pt-4 pb-2 pl-2 sm:pl-4 print:pt-4 print:pb-2 print:pl-0 border-l-4 border-amber-500 print:border-l-0"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">{cat.nome}</h2></td></tr>
              {prods.map((p) => (
                <tr key={p.id}><td className="py-1 print:py-1 overflow-hidden"><CardItem produto={p} /></td></tr>
              ))}
            </React.Fragment>
          );
        })}
        {produtosSemCategoria.length > 0 && (
          <>
            <tr className="cardapio-section-row bg-amber-50/80 print:bg-transparent"><td className="pt-4 pb-2 pl-2 sm:pl-4 print:pt-4 print:pb-2 print:pl-0 border-l-4 border-amber-500 print:border-l-0"><h2 className="text-lg font-semibold text-stone-800 print:text-sm print:font-bold print:uppercase print:border-b-2 print:border-stone-800 print:pb-1">Cardápio</h2></td></tr>
            {produtosSemCategoria.map((p) => (
              <tr key={p.id}><td className="py-1 print:py-1 overflow-hidden"><CardItem produto={p} /></td></tr>
            ))}
          </>
        )}
        </tbody>
      </table>
      {produtos.length === 0 && <p className="mx-auto max-w-6xl px-4 py-6 text-stone-500">Nenhum produto disponível.</p>}
      </div>
      {modalProduto && (
        <ModalProdutoCardapio produto={modalProduto} onClose={() => setModalProduto(null)} />
      )}
    </div>
  );
}
