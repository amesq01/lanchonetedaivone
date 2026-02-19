import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { getMesas, getComandaByMesa, getComandaWithPedidos, getProdutos, createPedidoPresencial, getPedidosByComanda, updatePedidoStatus } from '../../lib/api';
import type { Produto } from '../../types/database';

type ItemCarrinho = { produto: Produto; quantidade: number; observacao: string };

export default function AtendenteMesaDetail() {
  const { mesaId } = useParams();
  const [mesaNome, setMesaNome] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [comandaId, setComandaId] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!mesaId) return;
    getMesas().then((mesas) => {
      const m = mesas.find((x) => x.id === mesaId);
      setMesaNome(m?.nome ?? '');
    });
    getComandaByMesa(mesaId).then((c) => {
      if (!c) {
        setLoading(false);
        return;
      }
      setComandaId(c.id);
      setClienteNome(c.nome_cliente);
      getPedidosByComanda(c.id).then(setPedidos);
      setLoading(false);
    });
    getProdutos(true).then(setProdutos);
  }, [mesaId]);

  const filtrados = search.trim()
    ? produtos.filter((p) => p.descricao.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
    : [];

  const addItem = (produto: Produto, qtd = 1, obs = '') => {
    const exist = carrinho.find((i) => i.produto.id === produto.id && i.observacao === obs);
    if (exist) setCarrinho((c) => c.map((i) => i.produto.id === produto.id && i.observacao === obs ? { ...i, quantidade: i.quantidade + qtd } : i));
    else setCarrinho((c) => [...c, { produto, quantidade: qtd, observacao: obs }]);
    setSearch('');
  };

  const updateQtd = (index: number, delta: number) => {
    setCarrinho((c) => {
      const novo = [...c];
      novo[index].quantidade = Math.max(0, novo[index].quantidade + delta);
      return novo.filter((i) => i.quantidade > 0);
    });
  };

  const setObs = (index: number, obs: string) => {
    setCarrinho((c) => c.map((item, i) => (i === index ? { ...item, observacao: obs } : item)));
  };

  const finalizarPedido = async () => {
    if (!comandaId || carrinho.length === 0) return;
    setEnviando(true);
    try {
      const itens = carrinho.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        valor_unitario: Number(i.produto.valor),
        observacao: i.observacao || undefined,
      }));
      await createPedidoPresencial(comandaId, itens);
      setCarrinho([]);
      getPedidosByComanda(comandaId).then(setPedidos);
    } finally {
      setEnviando(false);
    }
  };

  const cancelarPedido = async (pedidoId: string) => {
    await updatePedidoStatus(pedidoId, 'cancelado');
    if (comandaId) getPedidosByComanda(comandaId).then(setPedidos);
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;
  if (!comandaId) return <p className="text-stone-500">Mesa não encontrada ou não está aberta.</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-stone-800">{mesaNome}</h1>
        <p className="text-stone-600">Cliente: {clienteNome}</p>
      </div>

      <div className="relative flex gap-2 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
            />
            {search.trim() && filtrados.length > 0 && (
              <div className="absolute left-4 right-4 mt-1 z-10 rounded-lg border border-stone-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                {filtrados.slice(0, 8).map((p) => (
                  <button key={p.id} type="button" onClick={() => addItem(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-stone-50 border-b border-stone-100 last:border-0">
                    <span className="text-sm font-medium text-stone-500">{p.codigo}</span>
                    <span className="text-stone-800">{p.descricao}</span>
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
              <div className="p-3 border-b border-stone-100 font-medium text-stone-700">Itens do pedido</div>
              <ul className="divide-y divide-stone-100">
                {carrinho.map((item, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 p-3">
                    <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-xs">IMG</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800">{item.produto.codigo} - {item.produto.descricao}</div>
                      <input type="text" value={item.observacao} onChange={(e) => setObs(i, e.target.value)} placeholder="Observação (ex: sem cebola)" className="mt-1 w-full text-sm rounded border border-stone-200 px-2 py-1" />
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

      <div className="space-y-2">
        {pedidos.filter((p) => p.status !== 'cancelado').map((p) => (
          <div key={p.id} className="rounded-xl bg-white border border-stone-200 overflow-hidden">
            <button type="button" onClick={() => setPedidoExpandido(pedidoExpandido === p.id ? null : p.id)} className="flex w-full items-center justify-between p-3 text-left font-medium text-stone-800">
              <span>Pedido #{p.numero}</span>
              {pedidoExpandido === p.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {pedidoExpandido === p.id && (
              <div className="border-t border-stone-100 p-3 flex flex-wrap items-start justify-between gap-2">
                <ul className="text-sm text-stone-600">
                  {(p.pedido_itens ?? []).map((i: any) => (
                    <li key={i.id}>{i.quantidade}x {i.produtos?.descricao} {i.observacao ? `(${i.observacao})` : ''}</li>
                  ))}
                </ul>
                {p.status === 'novo_pedido' && (
                  <button onClick={() => cancelarPedido(p.id)} className="text-sm text-red-600 hover:underline">Cancelar pedido</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {pedidos.filter((p) => p.status !== 'cancelado').length > 0 && (
        <button type="button" className="mt-4 w-full rounded-lg border-2 border-dashed border-amber-400 py-3 text-amber-700 font-medium hover:bg-amber-50">
          Adicionar outro pedido
        </button>
      )}
    </div>
  );
}
