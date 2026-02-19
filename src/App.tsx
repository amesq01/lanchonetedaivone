import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import AtendenteLayout from './layouts/AtendenteLayout';

import AdminMesas from './pages/admin/Mesas';
import AdminAtendentes from './pages/admin/Atendentes';
import AdminProdutos from './pages/admin/Produtos';
import AdminCupons from './pages/admin/Cupons';
import AdminTaxaEntrega from './pages/admin/TaxaEntrega';
import AdminMesaDetail from './pages/admin/MesaDetail';
import AdminViagem from './pages/admin/Viagem';
import AdminPedidosOnline from './pages/admin/PedidosOnline';
import AdminCozinha from './pages/admin/Cozinha';

import AtendenteMesas from './pages/atendente/Mesas';
import AtendenteMesaDetail from './pages/atendente/MesaDetail';
import AtendenteViagem from './pages/atendente/Viagem';
import AtendenteViagemNovo from './pages/atendente/ViagemNovo';

import LojaOnline from './pages/loja/LojaOnline';
import LojaCarrinho from './pages/loja/Carrinho';
import LojaCheckout from './pages/loja/Checkout';
import LojaObrigado from './pages/loja/Obrigado';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'admin' | 'atendente' }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (role === 'admin' && profile.role === 'atendente') return <Navigate to="/pdv" replace />;
  if (role && profile.role !== role && profile.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<LojaOnline />} />
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
      </Route>

      <Route path="/pdv" element={<ProtectedRoute><AtendenteLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/pdv/mesas" replace />} />
        <Route path="mesas" element={<AtendenteMesas />} />
        <Route path="mesas/:mesaId" element={<AtendenteMesaDetail />} />
        <Route path="viagem" element={<AtendenteViagem />} />
        <Route path="viagem/novo" element={<AtendenteViagemNovo />} />
      </Route>
    </Routes>
  );
}
