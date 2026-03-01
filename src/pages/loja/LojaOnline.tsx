import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { getProdutos, getCategorias } from '../../lib/api';
import type { Produto } from '../../types/database';
import type { Categoria } from '../../types/database';
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
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [qtyByProd, setQtyByProd] = useState<Record<string, number>>({});
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);

  const refreshCartCount = useCallback(() => {
    const cart = getCart();
    setCartCount(cart.reduce((s, i) => s + i.quantidade, 0));
  }, []);

  const carregarCardapio = useCallback(() => {
    setErro(null);
    setLoading(true);
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

  function updateQtyInCart(produto: Produto, newQty: number) {
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

  function removeFromCart(produto: Produto) {
    updateQtyInCart(produto, 0);
  }

  const byCategoria = (categoriaId: string | null) =>
    produtos.filter((p) => ((p as any).categoria_id ?? null) === (categoriaId ?? null));

  const categoriasComProdutos = categorias.filter((c) => byCategoria(c.id).length > 0);
  const semCategoria = byCategoria(null).length > 0;

  const exibirSemCategoria = categoriaSelecionada === null && semCategoria;
  const exibirCategoria = (cat: Categoria) =>
    categoriaSelecionada === null || categoriaSelecionada === cat.id;
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
            <h1 className="text-xl font-bold text-stone-800">Lanchonete Terra e Mar</h1>
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
          <nav className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={() => setCategoriaSelecionada(null)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${categoriaSelecionada === null ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              Todos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaSelecionada(cat.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${categoriaSelecionada === cat.id ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                {cat.nome}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {exibirSemCategoria && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">Cardápio</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-stretch">
              {byCategoria(null).map((p) => (
                <CardProduto key={p.id} produto={p} qty={qtyByProd[p.id] ?? 0} onQtyChange={(q) => updateQtyInCart(p, q)} onRemove={() => removeFromCart(p)} />
              ))}
            </div>
          </section>
        )}
        {categoriasComProdutos.filter(exibirCategoria).map((cat) => (
          <section key={cat.id} className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">{cat.nome}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-stretch">
              {byCategoria(cat.id).map((p) => (
                <CardProduto key={p.id} produto={p} qty={qtyByProd[p.id] ?? 0} onQtyChange={(q) => updateQtyInCart(p, q)} onRemove={() => removeFromCart(p)} />
              ))}
            </div>
          </section>
        ))}
        {categoriaVazia && (
          <p className="text-stone-500">Nenhum produto nesta categoria.</p>
        )}
        {produtos.length === 0 && <p className="text-stone-500">Nenhum produto disponível.</p>}
      </main>
    </div>
  );
}

function CardProduto({
  produto,
  qty,
  onQtyChange,
  onRemove,
}: {
  produto: Produto;
  qty: number;
  onQtyChange: (novaQty: number) => void;
  onRemove: () => void;
}) {
  const quantidade = Math.max(0, qty);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-amber-200">
      <div className="aspect-square w-full flex-shrink-0 overflow-hidden rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
        {produto.imagem_url ? <img src={produto.imagem_url} alt="" className="h-full w-full object-cover" /> : 'Sem imagem'}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="font-medium text-stone-800 leading-tight">{produto.nome || produto.descricao}</div>
        {produto.nome && produto.descricao ? <div className="mt-0.5 text-sm text-stone-500 leading-tight">{produto.descricao}</div> : null}
        {produto.acompanhamentos ? <div className="mt-2 min-h-[1.25rem] text-xs text-stone-500 leading-tight"><span className="font-medium text-stone-600">Acompanhamentos/Ingredientes:</span> {produto.acompanhamentos}</div> : <div className="min-h-[1.25rem]" />}
        <div className="mt-2 font-semibold text-amber-600">R$ {Number(produto.valor).toFixed(2)}</div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-stone-600">Quantidade:</span>
          <button type="button" onClick={() => onQtyChange(Math.max(0, qty - 1))} className="h-8 w-8 flex-shrink-0 rounded border border-stone-300 text-stone-600 hover:bg-stone-50">−</button>
          <span className="w-8 flex-shrink-0 text-center font-medium">{quantidade}</span>
          <button type="button" onClick={() => onQtyChange(qty + 1)} className="h-8 w-8 flex-shrink-0 rounded border border-stone-300 text-stone-600 hover:bg-stone-50">+</button>
        </div>
        <button type="button" onClick={onRemove} disabled={quantidade === 0} className="mt-3 w-full flex-shrink-0 rounded-lg border border-red-300 bg-white py-2 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Remover do carrinho
        </button>
      </div>
    </div>
  );
}
