import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import LojaOnline from './pages/loja/LojaOnline';

const Login = lazy(() => import('./pages/Login'));
const CardapioMesa = lazy(() => import('./pages/loja/CardapioMesa'));
const LojaCarrinho = lazy(() => import('./pages/loja/Carrinho'));
const LojaCheckout = lazy(() => import('./pages/loja/Checkout'));
const LojaObrigado = lazy(() => import('./pages/loja/Obrigado'));

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminMesas = lazy(() => import('./pages/admin/Mesas'));
const AdminAtendentes = lazy(() => import('./pages/admin/Atendentes'));
const AdminProdutos = lazy(() => import('./pages/admin/Produtos'));
const AdminCupons = lazy(() => import('./pages/admin/Cupons'));
const AdminTaxaEntrega = lazy(() => import('./pages/admin/TaxaEntrega'));
const AdminMesaDetail = lazy(() => import('./pages/admin/MesaDetail'));
const AdminViagem = lazy(() => import('./pages/admin/Viagem'));
const AdminPedidosOnline = lazy(() => import('./pages/admin/PedidosOnline'));
const AdminCozinha = lazy(() => import('./pages/admin/Cozinha'));
const AdminRelatorioFinanceiro = lazy(() => import('./pages/admin/RelatorioFinanceiro'));
const AdminRelatorioCancelamentos = lazy(() => import('./pages/admin/RelatorioCancelamentos'));
const AdminProdutividade = lazy(() => import('./pages/admin/Produtividade'));

const CozinhaLayout = lazy(() => import('./layouts/CozinhaLayout'));
const CozinhaKanban = lazy(() => import('./pages/cozinha/CozinhaKanban'));

const AtendenteLayout = lazy(() => import('./layouts/AtendenteLayout'));
const AtendenteMesas = lazy(() => import('./pages/atendente/Mesas'));
const AtendenteMesaDetail = lazy(() => import('./pages/atendente/MesaDetail'));
const AtendenteViagem = lazy(() => import('./pages/atendente/Viagem'));
const AtendenteViagemNovo = lazy(() => import('./pages/atendente/ViagemNovo'));

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <p className="text-stone-500">Carregando...</p>
    </div>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'admin' | 'atendente' | 'cozinha' }) {
  const { user, profile, loading, profileFetched } = useAuth();
  if (loading) return <PageLoading />;
  if (user && !profileFetched) return <PageLoading />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (role === 'admin' && (profile.role === 'atendente' || profile.role === 'cozinha')) return <Navigate to={profile.role === 'cozinha' ? '/cozinha' : '/pdv'} replace />;
  if (role === 'cozinha' && profile.role !== 'cozinha' && profile.role !== 'admin') return <Navigate to="/" replace />;
  if (role && role !== 'cozinha' && profile.role !== role && profile.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LojaOnline />} />
        <Route path="/cardapio" element={<CardapioMesa />} />
        <Route path="/carrinho" element={<LojaCarrinho />} />
        <Route path="/checkout" element={<LojaCheckout />} />
        <Route path="/obrigado" element={<LojaObrigado />} />

        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/mesas" replace />} />
          <Route path="mesas" element={<AdminMesas />} />
          <Route path="mesas/:mesaId" element={<AdminMesaDetail />} />
          <Route path="viagem" element={<AdminViagem />} />
          <Route path="pedidos-online" element={<AdminPedidosOnline />} />
          <Route path="cozinha" element={<AdminCozinha />} />
          <Route path="atendentes" element={<AdminAtendentes />} />
          <Route path="produtos" element={<AdminProdutos />} />
          <Route path="cupons" element={<AdminCupons />} />
          <Route path="taxa-entrega" element={<AdminTaxaEntrega />} />
          <Route path="relatorio-financeiro" element={<AdminRelatorioFinanceiro />} />
          <Route path="produtividade" element={<AdminProdutividade />} />
          <Route path="relatorio-cancelamentos" element={<AdminRelatorioCancelamentos />} />
        </Route>

        <Route path="/pdv" element={<ProtectedRoute><AtendenteLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/pdv/mesas" replace />} />
          <Route path="mesas" element={<AtendenteMesas />} />
          <Route path="mesas/:mesaId" element={<AtendenteMesaDetail />} />
          <Route path="viagem" element={<AtendenteViagem />} />
          <Route path="viagem/novo" element={<AtendenteViagemNovo />} />
        </Route>

        <Route path="/cozinha" element={<ProtectedRoute role="cozinha"><CozinhaLayout /></ProtectedRoute>}>
          <Route index element={<CozinhaKanban />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
