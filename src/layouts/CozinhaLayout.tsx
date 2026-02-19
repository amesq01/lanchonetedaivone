import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function CozinhaLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-stone-100">
      <header className="no-print flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white">
        <h1 className="text-xl font-bold text-stone-800">Cozinha</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">{profile?.nome}</span>
          <button
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
  );
}
