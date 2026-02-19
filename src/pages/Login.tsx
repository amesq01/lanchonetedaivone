import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, user, profile, loading, profileFetched, profileError, refetchProfile } = useAuth();

  // Redireciona no render (mais confiável que useEffect): já logado com perfil carregado
  if (!loading && user && profile) {
    const to = profile.role === 'admin' ? '/admin' : profile.role === 'cozinha' ? '/cozinha' : '/pdv';
    return <Navigate to={to} replace />;
  }

  const profileMissing = Boolean(user && profileFetched && !profile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message);
      return;
    }
    // Não redireciona aqui: o useEffect acima redireciona quando profile carregar
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
            <div className="rounded-lg bg-amber-50 p-4 text-amber-800 text-sm space-y-3">
              <p className="font-medium">Perfil não encontrado</p>
              {profileError && (
                <p className="text-red-700 bg-red-50 p-2 rounded text-xs">
                  Erro ao buscar perfil: {profileError}
                </p>
              )}
              <p>
                Seu <strong>UID atual</strong> é: <code className="bg-amber-100 px-1 rounded break-all text-xs">{user?.id}</code>
              </p>
              <p>No Supabase, confira se existe uma linha na tabela <strong>profiles</strong> com <code className="bg-amber-100 px-1 rounded text-xs">id = este UID</code>. Se acabou de inserir, clique em &quot;Tentar novamente&quot;.</p>
              <pre className="bg-amber-100 p-2 rounded text-xs overflow-x-auto">
                INSERT INTO profiles (id, role, nome, email) VALUES (&apos;{user?.id}&apos;, &apos;admin&apos;, &apos;Seu Nome&apos;, &apos;{email}&apos;);
              </pre>
              <button
                type="button"
                onClick={() => refetchProfile()}
                className="w-full rounded-lg border border-amber-600 py-2 text-amber-700 text-sm font-medium hover:bg-amber-100"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {user && !profile && !profileFetched && (
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
