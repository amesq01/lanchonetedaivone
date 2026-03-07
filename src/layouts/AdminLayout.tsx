import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNovoPedidoOnline } from '../hooks/useNovoPedidoOnline';
import { getAdminSidebarCounts, getLanchoneteAberta, setLanchoneteAberta as setLanchoneteAbertaApi } from '../lib/api';
import {
  UtensilsCrossed,
  Truck,
  ShoppingBag,
  ChefHat,
  Users,
  Package,
  Ticket,
  DollarSign,
  LogOut,
  BarChart3,
  FileX,
} from 'lucide-react';

const nav = [
  { to: '/admin/mesas', label: 'Mesas', icon: UtensilsCrossed, countKey: 'mesas' as const },
  { to: '/admin/viagem', label: 'Viagem', icon: Truck, countKey: 'viagem' as const },
  { to: '/admin/pedidos-online', label: 'Pedidos Online', icon: ShoppingBag, countKey: 'online' as const },
  { to: '/admin/cozinha', label: 'Cozinha', icon: ChefHat, countKey: 'cozinha' as const },
  { to: '/admin/atendentes', label: 'Atendentes', icon: Users },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/cupons', label: 'Cupons', icon: Ticket },
  { to: '/admin/taxa-entrega', label: 'Taxa Entrega', icon: DollarSign },
  { to: '/admin/relatorio-financeiro', label: 'Rel. Financeiro', icon: BarChart3 },
  { to: '/admin/relatorio-cancelamentos', label: 'Rel. Cancelamentos', icon: FileX },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { mostrar: novoPedidoOnline, count: pendentesOnline, fechar: fecharNovoPedido } = useNovoPedidoOnline();
  const [counts, setCounts] = useState({ mesas: 0, viagem: 0, online: 0, cozinha: 0 });
  const [lanchoneteAberta, setLanchoneteAberta] = useState<boolean | null>(null);
  const [confirmandoToggle, setConfirmandoToggle] = useState<'abrir' | 'fechar' | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    function load() {
      getAdminSidebarCounts().then(setCounts);
    }
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getLanchoneteAberta().then(setLanchoneteAberta);
  }, []);

  const handleToggleClick = () => {
    if (lanchoneteAberta === null) return;
    setConfirmandoToggle(lanchoneteAberta ? 'fechar' : 'abrir');
  };

  const confirmarToggle = async () => {
    if (confirmandoToggle === null) return;
    const novaAberta = confirmandoToggle === 'abrir';
    setToggleLoading(true);
    try {
      await setLanchoneteAbertaApi(novaAberta);
      setLanchoneteAberta(novaAberta);
      setConfirmandoToggle(null);
    } finally {
      setToggleLoading(false);
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
    <div className="flex h-screen bg-stone-100">
      {novoPedidoOnline && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-lg bg-amber-500 px-4 py-3 shadow-lg text-white animate-pulse">
          <span className="font-semibold">Novo pedido online!</span>
          <NavLink to="/admin/pedidos-online" className="underline font-medium">Ver ({pendentesOnline})</NavLink>
          <button onClick={fecharNovoPedido} className="ml-2 rounded px-2 py-0.5 bg-amber-600 hover:bg-amber-700">Fechar</button>
        </div>
      )}
      <aside className="no-print w-56 flex flex-col border-r border-stone-200 bg-white">
        <div className="p-4 border-b border-stone-200">
          <NavLink to="/admin" className="flex items-center gap-2 font-bold text-stone-800">
            <img src="/logo-terra-mar.png" alt="Terra & Mar" className="h-8 w-8 rounded-full object-contain flex-shrink-0" />
            Admin
          </NavLink>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, countKey }) => {
            const n = countKey ? counts[countKey] : 0;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-amber-100 text-amber-800' : 'text-stone-600 hover:bg-stone-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate">{label}</span>
                {n > 0 && (
                  <span className="flex-shrink-0 min-w-[1.25rem] text-center rounded-full bg-amber-500 text-white text-xs font-semibold px-1.5 py-0.5">
                    {n > 99 ? '99+' : n}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-2 border-t border-stone-200">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-stone-600">Pedidos online</span>
            <button
              type="button"
              onClick={handleToggleClick}
              disabled={lanchoneteAberta === null || toggleLoading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50 ${
                lanchoneteAberta ? 'bg-green-500' : 'bg-stone-300'
              }`}
              role="switch"
              aria-checked={lanchoneteAberta ?? false}
              title={lanchoneteAberta ? 'Fechar lanchonete online' : 'Abrir lanchonete online'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  lanchoneteAberta ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <p className="px-3 py-1 text-xs text-stone-500 truncate">{profile?.nome}</p>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
      {confirmandoToggle !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Confirmar</h3>
            <p className="text-sm text-stone-600 mb-4">
              {confirmandoToggle === 'abrir'
                ? 'Deseja realmente abrir a lanchonete para pedidos online?'
                : 'Deseja realmente fechar a lanchonete para pedidos online?'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmarToggle}
                disabled={toggleLoading}
                className={`flex-1 rounded-lg py-2 font-medium text-white disabled:opacity-50 ${
                  confirmandoToggle === 'abrir' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {toggleLoading ? 'Salvando...' : 'Sim, confirmar'}
              </button>
              <button onClick={() => setConfirmandoToggle(null)} disabled={toggleLoading} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
