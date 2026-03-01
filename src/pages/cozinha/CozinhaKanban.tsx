import { useEffect, useRef, useState } from 'react';
import { Volume2, Inbox, ChefHat, CheckCircle } from 'lucide-react';
import { getPedidosCozinha, updatePedidoStatus } from '../../lib/api';

let audioCtx: AudioContext | null = null;
let somAtivadoGlobal = true;

function tocarBip() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const ctx = audioCtx;
  const play = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
    osc2.start(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.65);
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

function playSomNovoPedido() {
  if (somAtivadoGlobal && audioCtx) tocarBip();
}

const COLUNAS = [
  { key: 'novo_pedido', label: 'Novo pedido', icon: Inbox, className: 'bg-amber-100 border-amber-200 text-amber-900' },
  { key: 'em_preparacao', label: 'Em preparação', icon: ChefHat, className: 'bg-blue-100 border-blue-200 text-blue-900' },
  { key: 'finalizado', label: 'Finalizado', icon: CheckCircle, className: 'bg-green-100 border-green-200 text-green-900' },
] as const;

function pedidoGeradoHa(fromAt: string): string {
  const min = Math.floor((Date.now() - new Date(fromAt).getTime()) / 60_000);
  if (min < 1) return 'há menos de 1 min';
  if (min === 1) return 'há 1 min';
  return `há ${min} min`;
}

function finalizadoHa(encerradoEm: string): string {
  const min = Math.floor((Date.now() - new Date(encerradoEm).getTime()) / 60_000);
  if (min < 1) return 'Finalizado há menos de 1 min';
  if (min === 1) return 'Finalizado há 1 min';
  if (min < 60) return `Finalizado há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas === 1) return 'Finalizado há 1 hora';
  return `Finalizado há ${horas} horas`;
}

function dataRefPedido(p: any): string | null {
  if (p.origem === 'online') return p.aceito_em ?? p.created_at ?? null;
  return p.created_at ?? null;
}

function nomeClienteEMesa(p: any) {
  const nome = p.cliente_nome || (p.comandas as any)?.nome_cliente || '-';
  const comandas = p.comandas as any;
  const mesaNum = comandas?.mesas?.numero;
  const mesaNome = comandas?.mesas?.nome;
  if (mesaNum !== undefined && mesaNum !== null && p.origem === 'presencial') {
    return `${nome} - ${mesaNome ?? `Mesa ${mesaNum}`}`;
  }
  return nome;
}

type ConfirmacaoAcao = { tipo: 'em_preparacao' | 'finalizado'; pedido: any };

export default function CozinhaKanban() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoAcao | null>(null);
  const [somAtivado, setSomAtivado] = useState(true);
  const idsNovoPedidoRef = useRef<Set<string> | null>(null);

  const toggleSom = () => {
    if (somAtivado) {
      somAtivadoGlobal = false;
      setSomAtivado(false);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    } else {
      try {
        const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!CtxClass) return;
        if (audioCtx?.state === 'closed') audioCtx = null;
        if (!audioCtx) audioCtx = new CtxClass();
        somAtivadoGlobal = true;
        setSomAtivado(true);
        audioCtx.resume().then(() => tocarBip()).catch(() => {});
      } catch {
        //
      }
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  // No primeiro clique (som ativado por padrão), cria o contexto de áudio para o bip poder tocar
  useEffect(() => {
    const unlock = () => {
      if (somAtivadoGlobal && !audioCtx) {
        try {
          const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (CtxClass) {
            audioCtx = new CtxClass();
            audioCtx.resume().catch(() => {});
          }
        } catch {
          //
        }
      }
    };
    document.addEventListener('click', unlock, { once: true });
    return () => document.removeEventListener('click', unlock);
  }, []);

  // Atualiza "há X minutos" a cada minuto nas duas primeiras colunas
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const data = await getPedidosCozinha();
    const idsNovoAgora = new Set((data || []).filter((p) => p.status === 'novo_pedido').map((p) => p.id));
    if (idsNovoPedidoRef.current !== null) {
      const temNovo = [...idsNovoAgora].some((id) => !idsNovoPedidoRef.current!.has(id));
      if (temNovo) playSomNovoPedido();
    }
    idsNovoPedidoRef.current = idsNovoAgora;
    setPedidos(data);
    setLoading(false);
  }

  async function mover(pedidoId: string, novoStatus: 'em_preparacao' | 'finalizado') {
    setConfirmacao(null);
    await updatePedidoStatus(pedidoId, novoStatus);
    load();
  }

  const hoje = new Date().toDateString();

  const porColuna = (key: string) => {
    if (key === 'finalizado') {
      const list = pedidos.filter((p) => p.status === 'finalizado' && (p.encerrado_em ? new Date(p.encerrado_em).toDateString() === hoje : new Date(p.updated_at).toDateString() === hoje));
      const dataFinalizado = (p: any) => new Date(p.encerrado_em ?? p.updated_at).getTime();
      return [...list].sort((a, b) => dataFinalizado(b) - dataFinalizado(a));
    }
    return pedidos.filter((p) => p.status === key);
  };

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-4">
        <div />
        <button
          type="button"
          onClick={toggleSom}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
            somAtivado
              ? 'border-green-500 bg-green-50 text-green-800 hover:bg-green-100'
              : 'border-stone-300 bg-stone-50 text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Volume2 className="h-4 w-4" />
          {somAtivado ? 'Desativar som de novos pedidos' : 'Ativar som de novos pedidos'}
        </button>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
      {COLUNAS.map((col) => {
        const Icon = col.icon;
        return (
        <div key={col.key} className="rounded-xl bg-stone-100 p-4 flex flex-col min-h-0">
          <h3 className={`font-semibold mb-3 flex-shrink-0 flex items-center gap-2 rounded-lg border px-3 py-2 ${col.className}`}>
            <Icon className="h-5 w-5 flex-shrink-0" />
            {col.label}
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {porColuna(col.key).map((p) => (
              <div key={p.id} className="rounded-lg bg-white p-3 shadow-sm border border-stone-200 flex-shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-stone-800">#{p.numero}</span>
                  <div className="flex flex-col items-end">
                    <span className={`text-xs px-2 py-0.5 rounded ${p.origem === 'online' ? 'bg-blue-100 text-blue-800' : p.origem === 'viagem' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                      {p.origem === 'online' ? 'ONLINE' : p.origem === 'viagem' ? 'VIAGEM' : 'Presencial'}
                    </span>
                    {(col.key === 'novo_pedido' || col.key === 'em_preparacao') && dataRefPedido(p) && (
                      <span className="text-[10px] text-stone-500 mt-0.5">{pedidoGeradoHa(dataRefPedido(p)!)}</span>
                    )}
                    {col.key === 'finalizado' && (p.encerrado_em ?? p.updated_at) && (
                      <span className="text-[10px] text-stone-500 mt-0.5">{finalizadoHa(p.encerrado_em ?? p.updated_at)}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-stone-600">{nomeClienteEMesa(p)}</p>
                <ul className="text-sm text-stone-500 mt-1">
                  {(p.pedido_itens ?? []).map((i: any) => (
                    <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao} {i.observacao ? ` (${i.observacao})` : ''}</li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  {p.status === 'novo_pedido' && (
                    <button onClick={() => setConfirmacao({ tipo: 'em_preparacao', pedido: p })} className="rounded bg-amber-600 px-2 py-1 text-sm text-white hover:bg-amber-700">
                      Preparar
                    </button>
                  )}
                  {p.status === 'em_preparacao' && (
                    <button onClick={() => setConfirmacao({ tipo: 'finalizado', pedido: p })} className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700">
                      Finalizar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })}
      </div>

      {confirmacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">
              {confirmacao.tipo === 'em_preparacao' ? 'Iniciar preparação' : 'Finalizar preparação'}
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              {confirmacao.tipo === 'em_preparacao'
                ? `Confirmar início da preparação do pedido #${confirmacao.pedido.numero}?`
                : `Confirmar que o pedido #${confirmacao.pedido.numero} está pronto?`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => mover(confirmacao.pedido.id, confirmacao.tipo)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium text-white ${confirmacao.tipo === 'em_preparacao' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmacao(null)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
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
