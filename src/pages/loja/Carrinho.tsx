import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProdutos } from '../../lib/api';
import type { Produto } from '../../types/database';

type Item = { produto: Produto; quantidade: number; observacao: string };

const CART_KEY = 'lanchonete_cart';

export type SavedItem = { produto_id: string; quantidade: number; observacao: string };

export function getCart(): SavedItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items: Item[]) {
  const toSave = items.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade, observacao: i.observacao }));
  localStorage.setItem(CART_KEY, JSON.stringify(toSave));
}

export default function LojaCarrinho() {
  const [searchParams] = useSearchParams();
  const addId = searchParams.get('add');
  const [produtos, setProdutos] = useState<Record<string, Produto>>({});
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProdutos(true).then((list) => {
      const map: Record<string, Produto> = {};
      list.forEach((p) => { map[p.id] = p; });
      setProdutos(map);
      let saved = getCart();
      if (addId && map[addId]) {
        const exist = saved.find((x) => x.produto_id === addId);
        if (exist) exist.quantidade++;
        else saved = [...saved, { produto_id: addId, quantidade: 1, observacao: '' }];
      }
      const cart: Item[] = saved.map((s) => ({ produto: map[s.produto_id], quantidade: s.quantidade, observacao: s.observacao })).filter((i) => i.produto);
      setItens(cart);
      saveCart(cart);
      setLoading(false);
    });
  }, [addId]);

  const qtdDeltaRef = useRef<{ index: number; delta: number; id: number } | null>(null);
  const appliedIdRef = useRef<number>(0);
  const updateQtd = (index: number, delta: number) => {
    const id = Date.now();
    qtdDeltaRef.current = { index, delta, id };
    setItens((prev) => {
      const applied = qtdDeltaRef.current;
      if (!applied || applied.index >= prev.length) return prev;
      if (appliedIdRef.current === applied.id) return prev;
      appliedIdRef.current = applied.id;
      const next = prev.map((item, i) =>
        i === applied.index ? { ...item, quantidade: Math.max(0, item.quantidade + applied.delta) } : item
      );
      const filtered = next.filter((i) => i.quantidade > 0);
      saveCart(filtered);
      return filtered;
    });
  };

  const setObs = (index: number, obs: string) => {
    setItens((prev) => {
      const next = [...prev];
      next[index].observacao = obs;
      saveCart(next);
      return next;
    });
  };

  const total = itens.reduce((s, i) => s + i.quantidade * Number(i.produto.valor), 0);

  if (loading) return <p className="p-4 text-stone-500">Carregando...</p>;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-amber-600 hover:underline">← Voltar</Link>
          <h1 className="text-xl font-bold text-stone-800">Carrinho</h1>
          <span className="w-12" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {itens.length === 0 ? (
          <p className="text-stone-500 text-center py-8">Carrinho vazio. <Link to="/" className="text-amber-600 hover:underline">Ver cardápio</Link></p>
        ) : (
          <>
            <ul className="space-y-4">
              {itens.map((item, i) => (
                <li key={i} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm border border-stone-100">
                  <div className="w-16 h-16 rounded-lg bg-stone-100 flex-shrink-0 flex items-center justify-center text-stone-400 text-xs">
                    {item.produto.imagem_url ? <img src={item.produto.imagem_url} alt="" className="rounded-lg w-full h-full object-cover" /> : 'IMG'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-800">{item.produto.descricao}</div>
                    <input type="text" value={item.observacao} onChange={(e) => setObs(i, e.target.value)} placeholder="Observação (ex: sem cebola)" className="mt-1 w-full text-sm rounded border border-stone-200 px-2 py-1" />
                    <div className="mt-1 flex items-center gap-2">
                      <button type="button" onClick={() => updateQtd(i, -1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">−</button>
                      <span className="w-6 text-center font-medium">{item.quantidade}</span>
                      <button type="button" onClick={() => updateQtd(i, 1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">+</button>
                    </div>
                  </div>
                  <div className="text-right font-medium text-amber-600">R$ {(item.quantidade * Number(item.produto.valor)).toFixed(2)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-white p-4 shadow-sm border border-stone-100">
              <div className="flex justify-between text-lg font-semibold text-stone-800">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              <Link to="/checkout" className="mt-4 block w-full rounded-lg bg-amber-600 py-3 text-center font-medium text-white hover:bg-amber-700">
                Finalizar pedido
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
