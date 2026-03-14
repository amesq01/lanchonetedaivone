import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPedidosOnlineData } from '../lib/api';
import { queryKeys } from '../lib/queryClient';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (_) {}
}

/** Usa useQuery (cache) + Realtime (invalida pedidos-online). Sem polling. */
export function useNovoPedidoOnline() {
  const [mostrar, setMostrar] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: queryKeys.pedidosOnline,
    queryFn: fetchPedidosOnlineData,
    staleTime: 60 * 1000,
  });

  const count = (data?.pendentes ?? []).length;

  useEffect(() => {
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      playBeep();
      setMostrar(true);
    }
    prevCountRef.current = count;
  }, [count]);

  const fechar = () => setMostrar(false);

  return { mostrar, count, fechar };
}
