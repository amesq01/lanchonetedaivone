import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getProdutos, createPedidoViagem } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Produto } from '../../types/database';

type ItemCarrinho = { produto: Produto; quantidade: number; observacao: string };

export default function AtendenteViagemNovo() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'nome' | 'itens'>('nome');
  const [nomeCliente, setNomeCliente] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getProdutos(true).then(setProdutos);
  }, []);

  const filtrados = search.trim()
    ? produtos.filter((p) => (p.nome?.toLowerCase().includes(search.toLowerCase())) || p.descricao.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
    : [];

  const addItem = (produto: Produto, qtd = 1, obs = '') => {
    const exist = carrinho.find((i) => i.produto.id === produto.id && i.observacao === obs);
    if (exist) setCarrinho((c) => c.map((i) => i.produto.id === produto.id && i.observacao === obs ? { ...i, quantidade: i.quantidade + qtd } : i));
    else setCarrinho((c) => [...c, { produto, quantidade: qtd, observacao: obs }]);
    setSearch('');
  };

  const qtdDeltaRef = useRef<{ index: number; delta: number; id: number } | null>(null);
  const appliedIdRef = useRef<number>(0);
  const updateQtd = (index: number, delta: number) => {
    const id = Date.now();
    qtdDeltaRef.current = { index, delta, id };
    setCarrinho((c) => {
      const applied = qtdDeltaRef.current;
      if (!applied || applied.index >= c.length) return c;
      if (appliedIdRef.current === applied.id) return c;
      appliedIdRef.current = applied.id;
      const novo = c.map((item, i) =>
        i === applied.index ? { ...item, quantidade: Math.max(0, item.quantidade + applied.delta) } : item
      );
      return novo.filter((i) => i.quantidade > 0);
    });
  };

  const setObs = (index: number, obs: string) => {
    setCarrinho((c) => c.map((item, i) => (i === index ? { ...item, observacao: obs } : item)));
  };

  const finalizarPedido = async () => {
    if (!nomeCliente.trim() || carrinho.length === 0 || !profile?.id) return;
    setEnviando(true);
    try {
      const itens = carrinho.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        valor_unitario: Number(i.produto.valor),
        observacao: i.observacao || undefined,
      }));
      await createPedidoViagem(nomeCliente.trim(), profile.id, itens);
      navigate('/pdv/viagem');
    } finally {
      setEnviando(false);
    }
  };

  if (step === 'nome') {
    return (
      <div className="max-w-sm mx-auto">
        <h1 className="text-xl font-bold text-stone-800 mb-4">Novo pedido - VIAGEM</h1>
        <label className="block text-sm font-medium text-stone-600 mb-2">Nome do cliente</label>
        <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4" placeholder="Ex: Maria" />
        <button onClick={() => nomeCliente.trim() && setStep('itens')} className="w-full rounded-lg bg-amber-600 py-2 text-white font-medium hover:bg-amber-700">
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-stone-800">VIAGEM - {nomeCliente}</h1>
      </div>
      <div className="relative flex gap-2 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou código..." className="flex-1 rounded-lg border border-stone-300 px-3 py-2" />
        {search.trim() && filtrados.length > 0 && (
          <div className="absolute left-0 right-12 top-full mt-1 z-10 rounded-lg border border-stone-200 bg-white shadow-lg max-h-48 overflow-y-auto">
            {filtrados.slice(0, 8).map((p) => (
              <button key={p.id} type="button" onClick={() => addItem(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-stone-50 border-b border-stone-100 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {p.imagem_url ? <img src={p.imagem_url} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                </div>
                <span className="text-sm font-medium text-stone-500">{p.codigo}</span>
                <span className="text-stone-800 truncate">{p.nome || p.descricao}</span>
                <span className="ml-auto text-amber-600 font-medium">R$ {Number(p.valor).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setSearch(search || ' ')} className="rounded-lg bg-amber-600 p-2 text-white hover:bg-amber-700" title="Adicionar item">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {carrinho.length > 0 && (
        <div className="rounded-xl bg-white border border-stone-200 overflow-hidden mb-4">
          <div className="p-3 border-b border-stone-100 font-medium text-stone-700">Itens</div>
          <ul className="divide-y divide-stone-100">
            {carrinho.map((item, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 p-3">
                <div className="w-12 h-12 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.produto.imagem_url ? <img src={item.produto.imagem_url} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-800">{item.produto.codigo} - {item.produto.nome || item.produto.descricao}</div>
                  <input type="text" value={item.observacao} onChange={(e) => setObs(i, e.target.value)} placeholder="Observação" className="mt-1 w-full text-sm rounded border border-stone-200 px-2 py-1" />
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateQtd(i, -1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">−</button>
                  <span className="w-8 text-center font-medium">{item.quantidade}</span>
                  <button type="button" onClick={() => updateQtd(i, 1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">+</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="p-3 border-t border-stone-100">
            <button onClick={finalizarPedido} disabled={enviando} className="w-full rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              {enviando ? 'Enviando...' : 'Finalizar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
