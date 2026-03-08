import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getMesas, getMesaIdsComComandaAberta, getMesasComComandaAberta, getComandaByMesaComAtendente, openComanda, getPedidosPresencialHoje } from '../../lib/api';
import { formatarTelefone } from '../../lib/mascaraTelefone';
import { useAuth } from '../../contexts/AuthContext';
import type { Mesa } from '../../types/database';

const statusLabel: Record<string, string> = {
  novo_pedido: 'Novo pedido',
  em_preparacao: 'Em preparação',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export default function AtendenteMesas() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<{ mesa: Mesa } | null>(null);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pedidosHoje, setPedidosHoje] = useState<any[]>([]);
  const [acordaoAberto, setAcordaoAberto] = useState<string | null>(null);
  const [acordaoPedidosAberto, setAcordaoPedidosAberto] = useState(false);
  const [mesaAbertaPor, setMesaAbertaPor] = useState<Record<string, string>>({});
  const [mesaAtendenteId, setMesaAtendenteId] = useState<Record<string, string>>({});
  const [erroAbrir, setErroAbrir] = useState<string | null>(null);
  const [alertaMesaOcupada, setAlertaMesaOcupada] = useState<{ mesaNome: string; atendente_nome: string } | null>(null);
  const [verificandoMesa, setVerificandoMesa] = useState(false);
  const [toastMesaOcupada, setToastMesaOcupada] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const nome = (location.state as { mesaOcupadaPorOutro?: string } | null)?.mesaOcupadaPorOutro;
    if (nome) {
      setToastMesaOcupada(`Essa mesa foi aberta por ${nome}. Apenas esse atendente pode acessá-la.`);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!toastMesaOcupada) return;
    const t = setTimeout(() => setToastMesaOcupada(null), 6000);
    return () => clearTimeout(t);
  }, [toastMesaOcupada]);

  async function load() {
    const [list, ocup, pedidos, abertasComAtendente] = await Promise.all([
      getMesas(),
      getMesaIdsComComandaAberta(),
      getPedidosPresencialHoje(),
      getMesasComComandaAberta(),
    ]);
    setMesas(list.filter((m) => !m.is_viagem));
    setOcupadas(ocup);
    setPedidosHoje(pedidos);
    const porMesa: Record<string, string> = {};
    const atendenteIdPorMesa: Record<string, string> = {};
    abertasComAtendente.forEach((a) => {
      porMesa[a.mesa_id] = a.atendente_nome;
      atendenteIdPorMesa[a.mesa_id] = a.atendente_id;
    });
    setMesaAbertaPor(porMesa);
    setMesaAtendenteId(atendenteIdPorMesa);
    setLoading(false);
  }

  async function handleAbrir(e: React.FormEvent) {
    e.preventDefault();
    if (!popup || !nomeCliente.trim() || !profile?.id) return;
    setErroAbrir(null);
    setSubmitting(true);
    try {
      const jaAberta = await getComandaByMesaComAtendente(popup.mesa.id);
      if (jaAberta) {
        setErroAbrir(`Esta mesa já está aberta por ${jaAberta.atendente_nome}. Outro atendente não pode abri-la.`);
        setSubmitting(false);
        return;
      }
      await openComanda(popup.mesa.id, profile.id, nomeCliente.trim(), telefone.trim() || undefined);
      setPopup(null);
      setNomeCliente('');
      setTelefone('');
      navigate(`/pdv/mesas/${popup.mesa.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClicarMesaDisponivel(mesa: Mesa) {
    setVerificandoMesa(true);
    setAlertaMesaOcupada(null);
    try {
      const jaAberta = await getComandaByMesaComAtendente(mesa.id);
      if (jaAberta) {
        setAlertaMesaOcupada({
          mesaNome: mesa.nome,
          atendente_nome: jaAberta.atendente_nome || 'outro atendente',
        });
        load();
        return;
      }
      setPopup({ mesa });
    } catch {
      setAlertaMesaOcupada({ mesaNome: mesa.nome, atendente_nome: 'outro atendente' });
    } finally {
      setVerificandoMesa(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  const pedidosHojeMeus = pedidosHoje.filter((p) => (p.comandas as any)?.atendente_id === profile?.id);

  return (
    <div>
      {toastMesaOcupada && (
        <div className="fixed top-4 right-4 z-[80] max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg text-amber-800 font-medium">
          {toastMesaOcupada}
        </div>
      )}
      <h1 className="text-xl font-bold text-stone-800 mb-4">Mesas</h1>
      <p className="text-stone-600 mb-4">Toque em uma mesa disponível para abrir.</p>

      {/* Accordion: Pedidos de hoje (mesas) */}
      <div className="mb-6 rounded-xl border border-stone-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setAcordaoPedidosAberto((a) => !a)}
          className="flex w-full items-center justify-between p-3 text-left font-medium text-stone-800 hover:bg-stone-50"
        >
          <span>Meus pedidos de hoje (mesas)</span>
          <span className="text-sm font-normal text-stone-500 mr-2">{pedidosHojeMeus.length} pedido(s)</span>
          {acordaoPedidosAberto ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {acordaoPedidosAberto && (
          <div className="border-t border-stone-100">
            {pedidosHojeMeus.length === 0 ? (
              <p className="p-3 text-sm text-stone-500">Nenhum pedido de mesa hoje.</p>
            ) : (
              pedidosHojeMeus.map((p) => {
                const mesaNome = (p.comandas as any)?.mesas?.nome ?? (p.comandas as any)?.mesas?.numero != null ? `Mesa ${(p.comandas as any).mesas.numero}` : '-';
                const cliente = (p.comandas as any)?.nome_cliente ?? '-';
                const expandido = acordaoAberto === p.id;
                return (
                  <div key={p.id} className="border-t border-stone-100 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => setAcordaoAberto(expandido ? null : p.id)}
                      className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-stone-50"
                    >
                      <span className="font-medium text-stone-800">
                      {(p.comandas as any)?.profiles?.nome
                        ? `Pedido #${p.numero} – ${(p.comandas as any).profiles.nome}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`
                        : `Pedido #${p.numero}${(p as any).lancado_pelo_admin ? ' (lançada pelo admin)' : ''}`}
                    </span>
                      <span className="text-stone-500 text-xs mr-2">{mesaNome} · {cliente}</span>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {mesas.map((m) => {
          const aberta = ocupadas.has(m.id);
          const abertaPorMim = aberta && mesaAtendenteId[m.id] === profile?.id;
          return (
            <div key={m.id} className="min-w-0">
              {abertaPorMim ? (
                <Link to={`/pdv/mesas/${m.id}`} className="block min-w-0 overflow-hidden rounded-xl bg-amber-100 p-4 text-center font-medium text-amber-800 shadow-sm hover:bg-amber-200">
                  {m.nome}
                  <span className="block min-w-0 truncate text-sm font-normal text-amber-700" title="Aberta por você">Aberta por você</span>
                </Link>
              ) : aberta ? (
                <button
                  type="button"
                  onClick={() => setToastMesaOcupada(`Esta mesa está aberta por ${mesaAbertaPor[m.id] || 'outro atendente'}. Apenas esse atendente pode acessá-la.`)}
                  className="block w-full min-w-0 overflow-hidden rounded-xl bg-amber-100 p-4 text-center font-medium text-amber-800 shadow-sm hover:bg-amber-200"
                >
                  {m.nome}
                  <span className="block min-w-0 truncate text-sm font-normal text-amber-700" title={`Aberta por ${mesaAbertaPor[m.id] || 'outro atendente'}`}>Aberta por {mesaAbertaPor[m.id] || 'outro atendente'}</span>
                </button>
              ) : (
                <button type="button" onClick={() => handleClicarMesaDisponivel(m)} disabled={verificandoMesa} className="block w-full rounded-xl bg-white p-4 text-center font-medium text-stone-700 shadow-sm border border-stone-200 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-70">
                  {m.nome}
                  <span className="block text-sm font-normal text-stone-500">{verificandoMesa ? 'Verificando...' : 'Disponível'}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Abrir {popup.mesa.nome}</h3>
            {erroAbrir && <p className="text-sm text-red-600 mb-3">{erroAbrir}</p>}
            <form onSubmit={handleAbrir}>
              <label className="block text-sm font-medium text-stone-600 mb-1">Nome do cliente</label>
              <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} required className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-3" placeholder="Ex: João" />
              <label className="block text-sm font-medium text-stone-600 mb-1">Telefone (opcional)</label>
              <input type="tel" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4" placeholder="(11) 99999-9999" />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                  Abrir
                </button>
                <button type="button" onClick={() => { setPopup(null); setNomeCliente(''); setTelefone(''); setErroAbrir(null); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alerta: mesa já aberta por outro atendente (portal no body para ficar sempre no topo) */}
      {alertaMesaOcupada && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="alerta-mesa-titulo">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border-2 border-amber-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-2xl" aria-hidden>⚠️</span>
              </div>
              <h2 id="alerta-mesa-titulo" className="text-lg font-semibold text-stone-800">Mesa já em uso</h2>
            </div>
            <p className="text-stone-600 mb-6">
              A <strong>{alertaMesaOcupada.mesaNome}</strong> já está aberta por <strong>{alertaMesaOcupada.atendente_nome}</strong>. Outro atendente não pode abri-la.
            </p>
            <button
              type="button"
              onClick={() => setAlertaMesaOcupada(null)}
              className="w-full rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-700"
            >
              Entendi
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
