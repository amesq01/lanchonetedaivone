import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { getMesas, getComandaByMesa, getProdutos, createPedidoPresencial, getPedidosByComanda, updatePedidoStatus, closeComanda } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Produto } from '../../types/database';

type ItemCarrinho = { produto: Produto; quantidade: number; observacao: string };

export default function AtendenteMesaDetail() {
  const { mesaId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
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
  const [popupFecharMesa, setPopupFecharMesa] = useState(false);
  const [popupCancelar, setPopupCancelar] = useState<{ pedidoId: string } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [fechando, setFechando] = useState(false);

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

  const pedidosAtivos = pedidos.filter((p) => p.status !== 'cancelado');
  const podeFecharMesa = pedidosAtivos.length === 0;

  const confirmarFecharMesa = async () => {
    if (!comandaId) return;
    setFechando(true);
    try {
      await closeComanda(comandaId, 'Sem consumo');
      setPopupFecharMesa(false);
      navigate('/pdv/mesas');
    } finally {
      setFechando(false);
    }
  };

  const confirmarCancelarPedido = async () => {
    if (!popupCancelar || !motivoCancelamento.trim()) return;
    await updatePedidoStatus(popupCancelar.pedidoId, 'cancelado', {
      motivo_cancelamento: motivoCancelamento.trim(),
      cancelado_por: profile?.id,
    });
    setPopupCancelar(null);
    setMotivoCancelamento('');
    if (comandaId) getPedidosByComanda(comandaId).then(setPedidos);
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;
  if (!comandaId) return <p className="text-stone-500">Mesa não encontrada ou não está aberta.</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-800">{mesaNome}</h1>
          <p className="text-stone-600">Cliente: {clienteNome}</p>
        </div>
        {podeFecharMesa && (
          <button onClick={() => setPopupFecharMesa(true)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600 hover:bg-stone-50 text-sm">
            Fechar mesa (sem pedidos)
          </button>
        )}
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
                    <div className="w-10 h-10 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {p.imagem_url ? <img src={p.imagem_url} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                    </div>
                    <span className="text-sm font-medium text-stone-500">{p.codigo}</span>
                    <span className="text-stone-800 truncate">{p.descricao}</span>
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
                    <div className="w-12 h-12 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {item.produto.imagem_url ? <img src={item.produto.imagem_url} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                    </div>
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
                  <button onClick={() => setPopupCancelar({ pedidoId: p.id })} className="text-sm text-red-600 hover:underline">Cancelar pedido</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {pedidosAtivos.length > 0 && (
        <button type="button" className="mt-4 w-full rounded-lg border-2 border-dashed border-amber-400 py-3 text-amber-700 font-medium hover:bg-amber-50">
          Adicionar outro pedido
        </button>
      )}

      {popupFecharMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Fechar mesa</h3>
            <p className="text-sm text-stone-600 mb-4">Não há pedidos nesta mesa. Deseja fechá-la?</p>
            <div className="flex gap-2">
              <button onClick={confirmarFecharMesa} disabled={fechando} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">Sim, fechar</button>
              <button onClick={() => setPopupFecharMesa(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {popupCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Cancelar pedido</h3>
            <p className="text-sm text-stone-600 mb-2">Informe o motivo do cancelamento (obrigatório para relatório):</p>
            <textarea value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4 min-h-[80px]" placeholder="Ex: Cliente desistiu" required />
            <div className="flex gap-2">
              <button onClick={confirmarCancelarPedido} disabled={!motivoCancelamento.trim()} className="flex-1 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-50">Confirmar cancelamento</button>
              <button onClick={() => { setPopupCancelar(null); setMotivoCancelamento(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
