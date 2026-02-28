import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UtensilsCrossed, Truck, LogOut } from 'lucide-react';

const nav = [
  { to: '/pdv/mesas', label: 'Mesas', icon: UtensilsCrossed },
  { to: '/pdv/viagem', label: 'Viagem', icon: Truck },
];

export default function AtendenteLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 md:flex">
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
