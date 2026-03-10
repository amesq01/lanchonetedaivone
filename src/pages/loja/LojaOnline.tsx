import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingCart, Trash2, X } from 'lucide-react';
import { getProdutos, getCategorias, getLanchoneteAberta, getLojaOnlineSoRetirada, getLojaOnlineMensagemAbertura } from '../../lib/api';
import type { ProdutoWithCategorias } from '../../types/database';
import type { Categoria } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';
import { getCart, type SavedItem } from './Carrinho';

const CART_KEY = 'lanchonete_cart';

function LojaLoading() {
  const emojis = ['🍔', '🍣', '🍤', '🍟'];
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-amber-50 via-orange-50 to-stone-100">
      {/* Prato girando (decorativo) */}
      <div
        className="absolute h-48 w-48 rounded-full border-4 border-amber-200/60 border-dashed opacity-60"
        style={{ animation: 'loading-plate-spin 4s linear infinite' }}
      />
      <div
        className="absolute h-40 w-40 rounded-full border-2 border-amber-300/40"
        style={{ animation: 'loading-plate-spin 6s linear infinite reverse' }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-6"
        style={{ animation: 'loading-bounce-in 0.6s ease-out both' }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-stone-800 sm:text-3xl">
          Lanchonete Terra e Mar
        </h1>
        <p
          className="text-sm font-medium text-amber-800/90 sm:text-base"
          style={{ animation: 'loading-pulse-text 1.2s ease-in-out infinite' }}
        >
          Montando o cardápio...
        </p>

        {/* Emojis flutuando em onda */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {emojis.map((emoji, i) => (
            <span
              key={i}
              className="text-4xl drop-shadow-sm sm:text-5xl"
              style={{
                animation: 'loading-float 1.8s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        {/* Hashi decorativo */}
        <div
          className="mt-2 flex gap-1 opacity-70"
          style={{ animation: 'loading-float 2s ease-in-out infinite' }}
        >
          <span className="text-2xl">🥢</span>
        </div>
      </div>
    </div>
  );
}

function saveCart(items: SavedItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export default function LojaOnline() {
  const [produtos, setProdutos] = useState<ProdutoWithCategorias[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [qtyByProd, setQtyByProd] = useState<Record<string, number>>({});
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [lanchoneteAberta, setLanchoneteAberta] = useState<boolean | null>(null);
  const [soRetirada, setSoRetirada] = useState<boolean>(false);
  const [mensagemAbertura, setMensagemAbertura] = useState<string | null>(null);
  const [modalProduto, setModalProduto] = useState<ProdutoWithCategorias | null>(null);

  const refreshCartCount = useCallback(() => {
    const cart = getCart();
    setCartCount(cart.reduce((s, i) => s + i.quantidade, 0));
  }, []);

  const carregarCardapio = useCallback(() => {
    setErro(null);
    setLoading(true);
    Promise.all([getLanchoneteAberta(), getLojaOnlineSoRetirada(), getLojaOnlineMensagemAbertura()]).then(([aberta, soRet, mensagem]) => {
      setLanchoneteAberta(aberta);
      setSoRetirada(soRet);
      setMensagemAbertura(mensagem);
    });
    Promise.all([getCategorias(), getProdutos(true)])
      .then(([cats, list]) => {
        setCategorias(cats);
        setProdutos(list);
        const cart = getCart();
        const byProd: Record<string, number> = {};
        cart.forEach((i) => {
          byProd[i.produto_id] = (byProd[i.produto_id] ?? 0) + i.quantidade;
        });
        setQtyByProd(byProd);
        setCartCount(cart.reduce((s, i) => s + i.quantidade, 0));
      })
      .catch((e) => {
        setErro(e?.message ?? 'Não foi possível carregar o cardápio.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    carregarCardapio();
  }, [carregarCardapio]);

  useEffect(() => {
    const onStorage = () => refreshCartCount();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshCartCount]);

  function updateQtyInCart(produto: ProdutoWithCategorias, newQty: number) {
    const cart = getCart();
    if (newQty <= 0) {
      const filtered = cart.filter((x) => x.produto_id !== produto.id);
      saveCart(filtered);
      setQtyByProd((prev) => ({ ...prev, [produto.id]: 0 }));
    } else {
      const exist = cart.find((x) => x.produto_id === produto.id);
      if (exist) {
        exist.quantidade = newQty;
      } else {
        cart.push({ produto_id: produto.id, quantidade: newQty, observacao: '' });
      }
      saveCart(cart);
      setQtyByProd((prev) => ({ ...prev, [produto.id]: newQty }));
    }
    const updated = getCart();
    setCartCount(updated.reduce((s, i) => s + i.quantidade, 0));
  }

  function removeFromCart(produto: ProdutoWithCategorias) {
    updateQtyInCart(produto, 0);
  }

  function openModal(produto: ProdutoWithCategorias) {
    if ((qtyByProd[produto.id] ?? 0) === 0) updateQtyInCart(produto, 1);
    setModalProduto(produto);
  }

  const promocoesCategoriaId = categorias.find((c) => c.nome.toUpperCase() === 'PROMOÇÕES')?.id ?? null;

  const byCategoria = (categoriaId: string | null) => {
    if (categoriaId === promocoesCategoriaId) {
      return produtos.filter((p) => p.em_promocao === true);
    }
    return produtos.filter((p) => {
      const ids = (p.produto_categorias ?? []).map((pc) => pc.categoria_id);
      if (categoriaId === null) return ids.length === 0;
      return ids.includes(categoriaId);
    });
  };

  const categoriasComProdutos = categorias.filter((c) => {
    if (c.nome.toUpperCase() === 'PROMOÇÕES') return produtos.some((p) => p.em_promocao === true);
    return byCategoria(c.id).length > 0;
  });
  const produtosSemCategoria = byCategoria(null).filter((p) => !p.em_promocao);
  const semCategoria = produtosSemCategoria.length > 0;

  const exibirSemCategoria = categoriaSelecionada === null && semCategoria;
  const exibirCategoria = (cat: Categoria) =>
    categoriaSelecionada === cat.id || (categoriaSelecionada === null && cat.nome.toUpperCase() !== 'PROMOÇÕES');
  const categoriaVazia =
    categoriaSelecionada !== null && byCategoria(categoriaSelecionada).length === 0;

  if (loading && !erro) return <LojaLoading />;

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-center text-stone-600">{erro}</p>
        <button
          type="button"
          onClick={carregarCardapio}
          className="rounded-lg bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <h1 className="text-xl font-bold text-stone-800">Lanchonete Terra e Mar</h1>
              {lanchoneteAberta !== null && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${lanchoneteAberta ? 'text-green-600' : 'text-red-600'}`}>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${lanchoneteAberta ? 'bg-green-500' : 'bg-red-500'}`} />
                  {lanchoneteAberta ? 'Aberto' : 'Fechado'} para pedidos
                  {mensagemAbertura && !lanchoneteAberta && (
                    <span className="text-stone-500 font-normal"> – {mensagemAbertura}</span>
                  )}
                </span>
              )}
            </div>
            <Link
              to="/carrinho"
              className="flex items-center gap-2 rounded-full bg-amber-600 pl-3 pr-4 py-2 text-white hover:bg-amber-700 sm:pl-4"
              aria-label={cartCount > 0 ? `Carrinho com ${cartCount} itens` : 'Carrinho'}
            >
              {cartCount > 0 && (
                <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-amber-600 shadow">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
              <ShoppingCart className="h-5 w-5 flex-shrink-0" />
              <span className="hidden sm:inline">Finalizar carrinho</span>
            </Link>
          </div>
          {soRetirada && (
            <p className="mt-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              No momento, pedidos estão disponíveis apenas para retirada no local.
            </p>
          )}
          <nav className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={() => setCategoriaSelecionada(null)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${categoriaSelecionada === null ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              Todos
            </button>
            {categorias.map((cat) => {
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
      <main className="mx-auto max-w-4xl px-2 py-4 sm:px-4 sm:py-6">
        {exibirSemCategoria && (
          <section className="mb-4 sm:mb-8">
            <h2 className="mb-2 sm:mb-4 text-lg font-semibold text-stone-800">Cardápio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 items-stretch">
              {produtosSemCategoria.map((p) => (
                <CardProduto key={p.id} produto={p} qty={qtyByProd[p.id] ?? 0} onOpenModal={() => openModal(p)} onRemove={() => removeFromCart(p)} />
              ))}
            </div>
          </section>
        )}
        {categoriasComProdutos.filter(exibirCategoria).map((cat) => (
          <section key={cat.id} className="mb-4 sm:mb-8">
            <h2 className="mb-2 sm:mb-4 text-lg font-semibold text-stone-800">{cat.nome}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 items-stretch">
              {byCategoria(cat.id).map((p) => (
                <CardProduto key={p.id} produto={p} qty={qtyByProd[p.id] ?? 0} onOpenModal={() => openModal(p)} onRemove={() => removeFromCart(p)} />
              ))}
            </div>
          </section>
        ))}
        {modalProduto && (
          <ModalProduto
            key={modalProduto.id}
            produto={modalProduto}
            qtyInCart={qtyByProd[modalProduto.id] ?? 0}
            onQtyChange={(novaQty) => updateQtyInCart(modalProduto, novaQty)}
            onClose={() => setModalProduto(null)}
          />
        )}
        {categoriaVazia && (
          <p className="text-stone-500">Nenhum produto nesta categoria.</p>
        )}
        {produtos.length === 0 && <p className="text-stone-500">Nenhum produto disponível.</p>}
      </main>
    </div>
  );
}

function ModalProduto({
  produto,
  qtyInCart,
  onQtyChange,
  onClose,
}: {
  produto: ProdutoWithCategorias;
  qtyInCart: number;
  onQtyChange: (novaQty: number) => void;
  onClose: () => void;
}) {
  const preco = precoVenda(produto);
  const emPromo = produto.em_promocao && produto.valor_promocional != null && Number(produto.valor_promocional) > 0;
  const qty = Math.max(0, qtyInCart);
  const fotos = imagensProduto(produto);
  const [idx, setIdx] = useState(0);
  const indice = Math.min(idx, Math.max(0, fotos.length - 1));
  const urlAtual = fotos[indice];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-produto-titulo">
      <div className="bg-white rounded-2xl shadow-xl max-w-[420px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-shrink-0">
          <button type="button" onClick={onClose} className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-600 hover:text-stone-800" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
          <div className="aspect-square w-full max-h-72 bg-stone-100 flex items-center justify-center text-stone-400 overflow-hidden relative">
            {urlAtual ? <img src={urlAtual} alt="" className="w-full h-full object-contain object-center" /> : 'Sem imagem'}
            {fotos.length > 1 && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + fotos.length) % fotos.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-600" aria-label="Imagem anterior"><ChevronLeft className="w-5 h-5" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % fotos.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-600" aria-label="Próxima imagem"><ChevronRight className="w-5 h-5" /></button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {fotos.map((_, i) => (
                    <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setIdx(i); }} className={`w-2 h-2 rounded-full transition ${i === indice ? 'bg-amber-500 scale-110' : 'bg-white/80 hover:bg-white'}`} aria-label={`Ver imagem ${i + 1}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <h2 id="modal-produto-titulo" className="text-xl font-semibold text-stone-800">{produto.nome || produto.descricao}</h2>
          {produto.nome && produto.descricao && <p className="mt-1 text-stone-600">{produto.descricao}</p>}
          {produto.ingredientes && (
            <p className="mt-3 text-sm text-stone-600"><span className="font-medium text-stone-700">Ingredientes:</span> {produto.ingredientes}</p>
          )}
          {produto.acompanhamentos && (
            <p className="mt-1 text-sm text-stone-600"><span className="font-medium text-stone-700">Acompanhamentos:</span> {produto.acompanhamentos}</p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Quantidade:</span>
            <button type="button" onClick={() => onQtyChange(Math.max(0, qty - 1))} className="w-9 h-9 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed" disabled={qty <= 0}>−</button>
            <span className="w-10 text-center font-semibold text-stone-800">{qty}</span>
            <button type="button" onClick={() => onQtyChange(qty + 1)} className="w-9 h-9 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium">+</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className={emPromo ? 'flex flex-col' : 'font-semibold text-amber-600'}>
              {emPromo ? (
                <>
                  <span className="text-xs text-stone-500">De: <span className="line-through text-stone-400 font-normal">R$ {Number(produto.valor).toFixed(2)}</span></span>
                  <span className="text-lg font-semibold text-amber-600">Por: R$ {Number(produto.valor_promocional).toFixed(2)}</span>
                </>
              ) : (
                <>R$ {preco.toFixed(2)}</>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="flex-1 min-w-[140px] rounded-xl bg-amber-600 py-3 px-3 text-white font-semibold opacity-90 hover:opacity-100 hover:bg-amber-700 flex items-center justify-center gap-1.5 transition-opacity"
            >
              <ShoppingCart className="w-5 h-5" />
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function labelAdicionado(q: number): string {
  if (q <= 0) return '';
  if (q === 1) return '1 adicionado';
  return (q < 10 ? '0' : '') + q + ' adicionados';
}

function CardProduto({
  produto,
  qty,
  onOpenModal,
  onRemove,
}: {
  produto: ProdutoWithCategorias;
  qty: number;
  onOpenModal: () => void;
  onRemove: () => void;
}) {
  const quantidade = Math.max(0, qty);
  const preco = precoVenda(produto);
  const emPromo = produto.em_promocao && produto.valor_promocional != null && Number(produto.valor_promocional) > 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenModal}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenModal(); } }}
      className="flex h-full min-h-0 flex-row sm:flex-col rounded-2xl border border-stone-100 bg-white p-2 sm:p-4 shadow-sm transition hover:shadow-md hover:border-amber-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
    >
      {/* Imagem: no mobile à esquerda (quadrada), centralizada; no sm+ em cima */}
      <div className="w-28 h-28 flex-shrink-0 self-center sm:self-auto sm:w-full sm:h-auto sm:aspect-square overflow-hidden rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 text-xs sm:text-sm">
        {imagensProduto(produto)[0] ? <img src={imagensProduto(produto)[0]} alt="" className="h-full w-full object-cover object-center" /> : 'Sem imagem'}
      </div>
      {/* Lado direito no mobile: texto + preço + botão */}
      <div className="flex-1 min-w-0 flex flex-col ml-2 sm:ml-0 sm:mt-3 gap-1 sm:gap-0">
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="font-medium text-stone-800 leading-tight line-clamp-2">{produto.nome || produto.descricao}</div>
          {produto.nome && produto.descricao ? <div className="text-sm text-stone-500 leading-tight line-clamp-1">{produto.descricao}</div> : null}
          {/* Ingredientes e acompanhamentos: só a partir de sm (ocultos no mobile); no modal aparecem sempre */}
          {produto.ingredientes ? <div className="hidden sm:block min-h-[1.25rem] text-xs text-stone-500 leading-tight line-clamp-2"><span className="font-medium text-stone-600">Ingredientes:</span> {produto.ingredientes}</div> : null}
          {produto.acompanhamentos ? <div className="hidden sm:block min-h-[1.25rem] text-xs text-stone-500 leading-tight line-clamp-2"><span className="font-medium text-stone-600">Acompanhamentos:</span> {produto.acompanhamentos}</div> : null}
        </div>
        <div className="flex flex-shrink-0 flex-col gap-2 pt-0 mt-1 sm:mt-1" onClick={(e) => e.stopPropagation()}>
          <div className="font-semibold text-amber-600">
            {emPromo ? (
              <>
                <span className="text-stone-400 line-through font-normal mr-1">R$ {Number(produto.valor).toFixed(2)}</span>
                <span className="text-amber-600">R$ {Number(produto.valor_promocional).toFixed(2)}</span>
              </>
            ) : (
              <>R$ {preco.toFixed(2)}</>
            )}
          </div>
          {quantidade > 0 && (
            <div className="text-xs font-medium text-stone-600">{labelAdicionado(quantidade)}</div>
          )}
          <div className="flex items-center gap-2 min-w-0 max-sm:justify-end">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
              className="flex-1 min-w-0 rounded-lg bg-amber-600 py-2 px-3 text-white font-medium opacity-80 hover:opacity-100 hover:bg-amber-700 flex items-center justify-center gap-1.5 transition-opacity max-sm:flex-none max-sm:w-[208px] max-sm:min-w-0 max-sm:h-[44px] max-sm:bg-[#f57c00] max-sm:hover:bg-[#e66d00] max-sm:text-[12px] max-sm:font-semibold max-sm:py-2 max-sm:px-3 max-sm:gap-1.5 max-sm:justify-end max-sm:rounded-none max-sm:[clip-path:path('M0,44_C10,44_20,43.5_30,42_C42,39_56,33_72,24_C92,12_118,5_156,4_L208,4_L208,44_Z')]"
              aria-label="Adicionar ao carrinho"
              title="Adicionar ao carrinho"
            >
              <span className="truncate">Adicionar ao</span>
              <ShoppingCart className="w-4 h-4 flex-shrink-0 max-sm:w-3.5 max-sm:h-3.5" />
            </button>
            {quantidade > 0 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="flex-shrink-0 w-9 h-9 max-sm:w-8 max-sm:h-8 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 flex items-center justify-center" aria-label="Retirar do carrinho" title="Retirar do carrinho">
                <Trash2 className="w-4 h-4 max-sm:w-3.5 max-sm:h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
