import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { CozinhaSoundProvider, CozinhaSoundToggle } from '../contexts/CozinhaSoundContext';
import { subscribePedidosAndComandasRealtime } from '../lib/supabaseRealtime';
import { LogOut } from 'lucide-react';

export default function CozinhaLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribePedidosAndComandasRealtime(queryClient);
  }, [queryClient]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true, state: { fromLogout: true } });
    }
  };

  return (
    <CozinhaSoundProvider>
      <div className="flex flex-col h-screen bg-stone-100">
        <header className="no-print flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-800">Cozinha</h1>
            <CozinhaSoundToggle />
          </div>
          <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">{profile?.nome}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden p-4">
          <Outlet />
        </main>
      </div>
    </CozinhaSoundProvider>
  );
}
