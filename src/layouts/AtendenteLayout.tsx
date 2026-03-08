import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UtensilsCrossed, Truck, LogOut, CheckCircle2 } from 'lucide-react';
import { subscribeToNotificacoesAtendente, marcarNotificacaoComoVista, getNotificacoesNaoVistas } from '../lib/api';

type Notificacao = { id: string; mensagem: string; pedido_numero: number };

const nav = [
  { to: '/pdv/mesas', label: 'Mesas', icon: UtensilsCrossed },
  { to: '/pdv/viagem', label: 'Viagem', icon: Truck },
];

/** Toca um bip curto para alertar o garçom (Web Audio API). */
function tocarBip() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Fallback: alguns navegadores exigem gesto do usuário antes de áudio
  }
}

export default function AtendenteLayout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const carregarNotificacoes = useCallback(async () => {
    if (!user?.id || profile?.role !== 'atendente') return;
    const list = await getNotificacoesNaoVistas(user.id);
    setNotificacoes(list.sort((a, b) => b.pedido_numero - a.pedido_numero));
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (!user?.id || profile?.role !== 'atendente') return;
    carregarNotificacoes();
    const unsub = subscribeToNotificacoesAtendente(user.id, (n) => {
      tocarBip();
      setNotificacoes((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        return [{ id: n.id, mensagem: n.mensagem, pedido_numero: n.pedido_numero }, ...prev];
      });
    });
    return unsub;
  }, [user?.id, profile?.role, carregarNotificacoes]);

  const marcarCiente = async (id: string) => {
    await marcarNotificacaoComoVista(id);
    setNotificacoes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true, state: { fromLogout: true } });
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 md:flex">
      {notificacoes.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-3 rounded-xl border border-green-200 bg-white p-4 shadow-lg max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-semibold text-stone-700 mb-1">Pedidos finalizados pela cozinha</p>
          {notificacoes.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50/50 p-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800">{n.mensagem}</p>
                <button
                  type="button"
                  onClick={() => marcarCiente(n.id)}
                  className="mt-2 text-sm font-medium text-amber-700 hover:underline"
                >
                  Ciente
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <header className="border-b border-stone-200 bg-white px-4 py-3 md:w-20 md:flex-col md:border-b-0 md:border-r md:py-6">
        <div className="flex items-center justify-between md:flex-col md:gap-6">
          <nav className="flex gap-2 md:flex-col">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-amber-100 text-amber-800' : 'text-stone-600 hover:bg-stone-100'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="md:sr-only">{label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {profile?.nome && (
          <p className="text-stone-600 mb-4">
            Olá, <span className="font-semibold text-stone-800">{profile.nome}</span>
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
