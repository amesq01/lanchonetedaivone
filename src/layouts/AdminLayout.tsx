import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNovoPedidoOnline } from '../hooks/useNovoPedidoOnline';
import { getAdminSidebarCounts } from '../lib/api';
import {
  LayoutDashboard,
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

  useEffect(() => {
    function load() {
      getAdminSidebarCounts().then(setCounts);
    }
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
            <LayoutDashboard className="h-6 w-6 text-amber-600" />
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
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
