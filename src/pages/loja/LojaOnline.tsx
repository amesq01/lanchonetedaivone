import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { getProdutos } from '../../lib/api';
import type { Produto } from '../../types/database';

export default function LojaOnline() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProdutos(true).then(setProdutos).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-stone-800">Lanchonete & Sushi</h1>
          <Link to="/carrinho" className="flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
            <ShoppingCart className="h-5 w-5" />
            Carrinho
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading ? (
          <p className="text-stone-500">Carregando...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((p) => (
              <Link key={p.id} to={`/carrinho?add=${p.id}`} className="rounded-2xl bg-white p-4 shadow-sm border border-stone-100 transition hover:shadow-md hover:border-amber-200">
                <div className="aspect-square rounded-xl bg-stone-100 mb-3 flex items-center justify-center text-stone-400 text-sm">
                  {p.imagem_url ? <img src={p.imagem_url} alt="" className="rounded-xl w-full h-full object-cover" /> : 'Sem imagem'}
                </div>
                <div className="font-medium text-stone-800">{p.descricao}</div>
                {p.acompanhamentos && <div className="text-xs text-stone-500 mt-0.5">{p.acompanhamentos}</div>}
                <div className="mt-2 font-semibold text-amber-600">R$ {Number(p.valor).toFixed(2)}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
