import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UtensilsCrossed, Truck, LogOut, CheckCircle2 } from 'lucide-react';
import { subscribeToNotificacoesAtendente, marcarNotificacaoComoVista } from '../lib/api';

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
  const [toast, setToast] = useState<{ id: string; mensagem: string } | null>(null);

  useEffect(() => {
    if (!user?.id || profile?.role !== 'atendente') return;
    const unsub = subscribeToNotificacoesAtendente(user.id, (n) => {
      tocarBip();
      setToast({ id: n.id, mensagem: n.mensagem });
    });
    return unsub;
  }, [user?.id, profile?.role]);

  const confirmarVisto = () => {
    if (toast) {
      marcarNotificacaoComoVista(toast.id);
      setToast(null);
    }
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
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-3 rounded-xl border border-green-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-green-600" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-800">{toast.mensagem}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={confirmarVisto}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Confirmar visto
            </button>
          </div>
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
        <Outlet />
      </main>
    </div>
  );
}
