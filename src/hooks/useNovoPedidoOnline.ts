import { useEffect, useRef, useState } from 'react';
import { getPedidosOnlinePendentes } from '../lib/api';

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

export function useNovoPedidoOnline() {
  const [mostrar, setMostrar] = useState(false);
  const [count, setCount] = useState(0);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      if (!mounted) return;
      const lista = await getPedidosOnlinePendentes();
      const n = lista.length;
      if (prevCountRef.current !== null && n > prevCountRef.current) {
        playBeep();
        setMostrar(true);
        setCount(n);
      }
      prevCountRef.current = n;
      setCount(n);
    }
    poll();
    const t = setInterval(poll, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const fechar = () => setMostrar(false);

  return { mostrar, count, fechar };
}
