import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
} from 'lucide-react';

const nav = [
  { to: '/admin/mesas', label: 'Mesas', icon: UtensilsCrossed },
  { to: '/admin/viagem', label: 'Viagem', icon: Truck },
  { to: '/admin/pedidos-online', label: 'Pedidos Online', icon: ShoppingBag },
  { to: '/admin/cozinha', label: 'Cozinha', icon: ChefHat },
  { to: '/admin/atendentes', label: 'Atendentes', icon: Users },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/cupons', label: 'Cupons', icon: Ticket },
  { to: '/admin/taxa-entrega', label: 'Taxa Entrega', icon: DollarSign },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-stone-100">
      <aside className="w-56 flex flex-col border-r border-stone-200 bg-white">
        <div className="p-4 border-b border-stone-200">
          <NavLink to="/admin" className="flex items-center gap-2 font-bold text-stone-800">
            <LayoutDashboard className="h-6 w-6 text-amber-600" />
            Admin
          </NavLink>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
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
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
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
