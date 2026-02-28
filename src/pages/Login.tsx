import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, user, profile, loading, profileFetched } = useAuth();

  const loadingProfile = Boolean(user && !profile && !profileFetched);
  const profileMissing = Boolean(user && profileFetched && !profile);

  // Redireciona no render: já logado com perfil carregado (ex.: refresh da página)
  if (!loading && user && profile) {
    const to = profile.role === 'admin' ? '/admin' : profile.role === 'cozinha' ? '/cozinha' : '/pdv';
    return <Navigate to={to} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err, profile: profileData } = await signIn(email, password);
    if (err) {
      setError(err.message);
      return;
    }
    if (profileData) {
      const to = profileData.role === 'admin' ? '/admin' : profileData.role === 'cozinha' ? '/cozinha' : '/pdv';
      window.location.replace(to);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-200 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-stone-800">Acesso</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {profileMissing && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">
              <p className="font-medium">Erro ao realizar login.</p>
              <p className="mt-1 text-red-700">Atualize a página e tente novamente.</p>
            </div>
          )}
          {loadingProfile && (
            <p className="text-sm text-stone-500">Carregando perfil...</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
