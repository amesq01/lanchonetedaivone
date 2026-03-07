import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getPedidosViagemAbertos, getPedidosViagemHoje, getPedidoStatus, updatePedidoStatus } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const statusLabel: Record<string, string> = {
  novo_pedido: 'Novo pedido',
  em_preparacao: 'Em preparação',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export default function AtendenteViagem() {
  const { profile } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidosHoje, setPedidosHoje] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [popupExcluir, setPopupExcluir] = useState<{ pedidoId: string } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [acordaoAberto, setAcordaoAberto] = useState<string | null>(null);
  const [acordaoPedidosAberto, setAcordaoPedidosAberto] = useState(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [data, hoje] = await Promise.all([getPedidosViagemAbertos(), getPedidosViagemHoje()]);
    setPedidos(data.filter((p) => p.status === 'novo_pedido'));
    setPedidosHoje(hoje);
    setLoading(false);
  }

  const confirmarExcluir = async () => {
    if (!popupExcluir) return;
    const atual = await getPedidoStatus(popupExcluir.pedidoId);
    if (!atual) {
      setToast('Pedido não encontrado.');
      setPopupExcluir(null);
      setMotivoCancelamento('');
      return;
    }
    if (atual.status !== 'novo_pedido') {
      setToast(`Não é possível excluir. O pedido já está: ${statusLabel[atual.status] ?? atual.status}. A cozinha já pode ter iniciado o preparo.`);
      setPopupExcluir(null);
      setMotivoCancelamento('');
      return;
    }
    await updatePedidoStatus(popupExcluir.pedidoId, 'cancelado', {
      motivo_cancelamento: motivoCancelamento.trim(),
      cancelado_por: profile?.id,
    });
    setPopupExcluir(null);
    setMotivoCancelamento('');
    load();
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  const pedidosHojeMeus = pedidosHoje.filter((p) => (p.comandas as any)?.atendente_id === profile?.id);

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg text-amber-800">
          {toast}
        </div>
      )}
      <h1 className="text-xl font-bold text-stone-800 mb-4">Mesa VIAGEM</h1>
      <p className="text-stone-600 mb-4">Pedidos para viagem. Nunca bloqueada.</p>
      <Link to="/pdv/viagem/novo" className="mb-6 block w-full rounded-xl bg-amber-600 py-3 text-center font-medium text-white hover:bg-amber-700">
        NOVO PEDIDO
      </Link>

      {/* Accordion: Pedidos de hoje (viagem) - somente deste atendente */}
      <div className="mb-6 rounded-xl border border-stone-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setAcordaoPedidosAberto((a) => !a)}
          className="flex w-full items-center justify-between p-3 text-left font-medium text-stone-800 hover:bg-stone-50"
        >
          <span>Meus pedidos de hoje (viagem)</span>
          <span className="text-sm font-normal text-stone-500 mr-2">{pedidosHojeMeus.length} pedido(s)</span>
          {acordaoPedidosAberto ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {acordaoPedidosAberto && (
          <div className="border-t border-stone-100">
            {pedidosHojeMeus.length === 0 ? (
              <p className="p-3 text-sm text-stone-500">Nenhum pedido de viagem hoje.</p>
            ) : (
              pedidosHojeMeus.map((p) => {
                const expandido = acordaoAberto === p.id;
                return (
                  <div key={p.id} className="border-t border-stone-100 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => setAcordaoAberto(expandido ? null : p.id)}
                      className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-stone-50"
                    >
                      <span className="font-medium text-stone-800">Pedido #{p.numero}</span>
                      <span className="text-stone-500 text-xs mr-2">{p.cliente_nome ?? '-'}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600">{statusLabel[p.status] ?? p.status}</span>
                      {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandido && (
                      <div className="px-3 pb-3 pt-0 text-sm text-stone-600 border-t border-stone-100 bg-stone-50/50">
                        <ul className="list-disc list-inside">
                          {(p.pedido_itens ?? []).map((i: any) => (
                            <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}{i.observacao ? ` (${i.observacao})` : ''}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-stone-500">
                          {p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : ''}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm border border-stone-200 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
              <div className="text-sm text-stone-600">{p.cliente_nome}</div>
              <ul className="text-sm text-stone-500 mt-1">
                {(p.pedido_itens ?? []).map((i: any) => (
                  <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setPopupExcluir({ pedidoId: p.id })}
              className="flex-shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Excluir pedido
            </button>
          </div>
        ))}
      </div>

      {popupExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Excluir pedido</h3>
            <p className="text-sm text-stone-600 mb-2">Só é possível excluir se a cozinha ainda não tiver iniciado o preparo.</p>
            <p className="text-sm text-stone-600 mb-2">Informe o motivo do cancelamento (obrigatório para relatório):</p>
            <textarea
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Cliente desistiu"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mb-4 min-h-[80px]"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarExcluir}
                disabled={!motivoCancelamento.trim()}
                className="flex-1 rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => { setPopupExcluir(null); setMotivoCancelamento(''); }}
                className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
