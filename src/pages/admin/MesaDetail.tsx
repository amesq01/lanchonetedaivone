import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getComandaByMesa, getComandaWithPedidos, getTotalComanda, closeComanda, getMesas, updatePedidoStatus } from '../../lib/api';
import type { Comanda } from '../../types/database';

export default function AdminMesaDetail() {
  const { mesaId } = useParams();
  const navigate = useNavigate();
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mesaNome, setMesaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [popupPagamento, setPopupPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [contaItens, setContaItens] = useState<{ itens: { codigo: string; descricao: string; quantidade: number; valor: number }[]; total: number } | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    if (!mesaId) return;
    getMesas().then((mesas) => {
      const m = mesas.find((x) => x.id === mesaId);
      setMesaNome(m?.nome ?? '');
    });
    getComandaByMesa(mesaId).then((c) => {
      setComanda(c);
      if (c) {
        getComandaWithPedidos(c.id).then((r) => setPedidos(r?.pedidos ?? []));
        getTotalComanda(c.id).then(setContaItens);
      }
      setLoading(false);
    });
  }, [mesaId]);

  const handleImprimirConta = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  };

  const handleEncerrar = () => {
    setPopupPagamento(true);
  };

  const confirmarEncerramento = async () => {
    if (!comanda || !formaPagamento) return;
    await closeComanda(comanda.id, formaPagamento);
    setPopupPagamento(false);
    navigate('/admin/mesas');
  };

  const cancelarPedido = async (pedidoId: string) => {
    await updatePedidoStatus(pedidoId, 'cancelado');
    if (comanda) {
      getComandaWithPedidos(comanda.id).then((r) => setPedidos(r?.pedidos ?? []));
      getTotalComanda(comanda.id).then(setContaItens);
    }
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;
  if (!comanda) return <p className="text-stone-500">Mesa não está aberta.</p>;

  const formas = ['dinheiro', 'pix', 'cartão crédito', 'cartão débito'];

  return (
    <div className={printMode ? 'bg-white p-6 print:p-4' : ''}>
      {printMode && (
        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold text-stone-800">Conta</h2>
          <p className="text-stone-600">{mesaNome} - {comanda.nome_cliente}</p>
        </div>
      )}
      {!printMode && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">{mesaNome}</h1>
              <p className="text-stone-600">Cliente: {comanda.nome_cliente}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleImprimirConta} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-50">
                Imprimir conta
              </button>
              <button onClick={handleEncerrar} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
                Encerrar mesa
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm mb-6">
            <h3 className="font-semibold text-stone-800 mb-2">Pedidos</h3>
            {pedidos.filter((p) => p.status !== 'cancelado').map((p) => (
              <div key={p.id} className="border-b border-stone-100 py-2">
                <div className="font-medium">Pedido #{p.numero}</div>
                <ul className="text-sm text-stone-600">
                  {(p.pedido_itens ?? []).map((i: any) => (
                    <li key={i.id}>{i.quantidade}x {i.produtos?.descricao} - R$ {(i.quantidade * i.valor_unitario).toFixed(2)}</li>
                  ))}
                </ul>
                {p.status === 'novo_pedido' && (
                  <button onClick={() => cancelarPedido(p.id)} className="mt-1 text-sm text-red-600 hover:underline">Cancelar pedido</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {contaItens && (
        <div className={printMode ? 'border-t pt-4' : 'rounded-xl bg-white p-4 shadow-sm'}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 text-sm font-medium text-stone-600">Código</th>
                <th className="text-left py-2 text-sm font-medium text-stone-600">Descrição</th>
                <th className="text-right py-2 text-sm font-medium text-stone-600">Qtd</th>
                <th className="text-right py-2 text-sm font-medium text-stone-600">Valor</th>
              </tr>
            </thead>
            <tbody>
              {contaItens.itens.map((item, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2">{item.codigo}</td>
                  <td className="py-2">{item.descricao}</td>
                  <td className="py-2 text-right">{item.quantidade}</td>
                  <td className="py-2 text-right">R$ {item.valor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end font-semibold text-stone-800">Total: R$ {contaItens.total.toFixed(2)}</div>
        </div>
      )}

      {popupPagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-4">Forma de pagamento</h3>
            <div className="space-y-2">
              {formas.map((f) => (
                <button key={f} onClick={() => setFormaPagamento(f)} className={`block w-full rounded-lg border py-2 text-left px-3 ${formaPagamento === f ? 'border-amber-500 bg-amber-50' : 'border-stone-200'}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmarEncerramento} disabled={!formaPagamento} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                Confirmar encerramento
              </button>
              <button onClick={() => setPopupPagamento(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
