import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { getConfig, getProdutos, validarCupom } from '../../lib/api';
import type { Produto } from '../../types/database';

type Item = { produto: Produto; quantidade: number; observacao: string };

const CART_KEY = 'lanchonete_cart';
const CUPOM_KEY = 'lanchonete_cupom';

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

export function getCupomAplicado(): { codigo: string; porcentagem: number; valorMaximo?: number } | null {
  try {
    const raw = localStorage.getItem(CUPOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.codigo && typeof parsed.porcentagem === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearCupomAplicado() {
  localStorage.removeItem(CUPOM_KEY);
}

function saveCart(items: Item[]) {
  const toSave = items.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade, observacao: i.observacao }));
  localStorage.setItem(CART_KEY, JSON.stringify(toSave));
}

export default function LojaCarrinho() {
  const [searchParams] = useSearchParams();
  const addId = searchParams.get('add');
  const [, setProdutos] = useState<Record<string, Produto>>({});
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; porcentagem: number; valorMaximo?: number } | null>(() => getCupomAplicado());
  const [cupomErro, setCupomErro] = useState('');
  const [cupomLoading, setCupomLoading] = useState(false);
  const [taxaEntrega, setTaxaEntrega] = useState<number | null>(null);

  useEffect(() => {
    getConfig('taxa_entrega').then(setTaxaEntrega);
  }, []);

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

  const removeItem = (index: number) => {
    setItens((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveCart(next);
      return next;
    });
  };

  const rawSubtotal = itens.reduce((s, i) => s + i.quantidade * Number(i.produto.valor), 0);
  const subtotal = Number.isFinite(rawSubtotal) ? rawSubtotal : 0;
  const taxa = taxaEntrega !== null && Number.isFinite(taxaEntrega) ? taxaEntrega : 0;
  let rawDesconto = cupomAplicado ? (subtotal * Number(cupomAplicado.porcentagem)) / 100 : 0;
  if (cupomAplicado?.valorMaximo != null) rawDesconto = Math.min(rawDesconto, cupomAplicado.valorMaximo);
  const desconto = Number.isFinite(rawDesconto) ? rawDesconto : 0;
  const total = Math.max(0, subtotal + taxa - desconto) || 0;

  async function handleAplicarCupom() {
    setCupomErro('');
    if (!cupomInput.trim()) {
      setCupomErro('Digite o código do cupom.');
      return;
    }
    setCupomLoading(true);
    try {
      const result = await validarCupom(cupomInput.trim());
      if ('error' in result) {
        setCupomErro(result.error);
        return;
      }
      const aplicado = {
        codigo: result.cupom.codigo,
        porcentagem: Number(result.cupom.porcentagem),
        ...(result.cupom.valor_maximo != null && { valorMaximo: Number(result.cupom.valor_maximo) }),
      };
      setCupomAplicado(aplicado);
      localStorage.setItem(CUPOM_KEY, JSON.stringify(aplicado));
      setCupomInput('');
    } finally {
      setCupomLoading(false);
    }
  }

  function handleRemoverCupom() {
    setCupomAplicado(null);
    setCupomErro('');
    setCupomInput('');
    localStorage.removeItem(CUPOM_KEY);
  }

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
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-amber-600">R$ {(item.quantidade * Number(item.produto.valor)).toFixed(2)}</span>
                    <button type="button" onClick={() => removeItem(i)} className="p-1.5 rounded text-stone-400 hover:bg-red-50 hover:text-red-600" title="Remover item" aria-label="Remover item">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-white p-4 shadow-sm border border-stone-100 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-2">Cupom de desconto</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cupomInput}
                    onChange={(e) => { setCupomInput(e.target.value); setCupomErro(''); }}
                    placeholder="Código do cupom"
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
                    disabled={!!cupomAplicado}
                  />
                  <button
                    type="button"
                    onClick={handleAplicarCupom}
                    disabled={cupomLoading || !!cupomAplicado}
                    className="rounded-lg bg-stone-700 px-4 py-2 text-white font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cupomLoading ? 'Verificando...' : cupomAplicado ? 'Aplicado' : 'Aplicar cupom'}
                  </button>
                </div>
                {cupomErro && <p className="mt-1 text-sm text-red-600">{cupomErro}</p>}
                {cupomAplicado && (
                  <p className="mt-1 text-sm text-green-600">
                    Cupom {cupomAplicado.codigo} aplicado ({cupomAplicado.porcentagem}% de desconto). <button type="button" onClick={handleRemoverCupom} className="underline hover:no-underline">Remover</button>
                  </p>
                )}
              </div>
              <div className="space-y-1 pt-2 border-t border-stone-200">
                <div className="flex justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-stone-600">
                  <span>Taxa de entrega</span>
                  <span>R$ {(Number.isFinite(taxa) ? taxa : 0).toFixed(2)}</span>
                </div>
                {desconto > 0 && (
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>Desconto (cupom)</span>
                    <span>- R$ {desconto.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold text-stone-800 pt-1">
                  <span>Total</span>
                  <span>R$ {(Number.isFinite(total) ? total : 0).toFixed(2)}</span>
                </div>
              </div>
              <Link to="/checkout" className="block w-full rounded-lg bg-amber-600 py-3 text-center font-medium text-white hover:bg-amber-700">
                Finalizar pedido
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
