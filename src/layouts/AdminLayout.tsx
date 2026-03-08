import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNovoPedidoOnline } from '../hooks/useNovoPedidoOnline';
import { getAdminSidebarCounts, getLanchoneteAberta, setLanchoneteAberta as setLanchoneteAbertaApi, getLojaOnlineSoRetirada, setLojaOnlineSoRetirada as setLojaOnlineSoRetiradaApi, getLojaOnlineHorarioAbertura, setLojaOnlineHorarioAbertura as setLojaOnlineHorarioAberturaApi } from '../lib/api';
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
  Menu,
  X,
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
  const location = useLocation();
  const { mostrar: novoPedidoOnline, count: pendentesOnline, fechar: fecharNovoPedido } = useNovoPedidoOnline();
  const [counts, setCounts] = useState({ mesas: 0, viagem: 0, online: 0, cozinha: 0 });
  const [menuAberto, setMenuAberto] = useState(false);
  const [lanchoneteAberta, setLanchoneteAberta] = useState<boolean | null>(null);
  const [soRetirada, setSoRetirada] = useState<boolean | null>(null);
  const [confirmandoToggle, setConfirmandoToggle] = useState<'abrir' | 'fechar' | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [soRetiradaLoading, setSoRetiradaLoading] = useState(false);
  const [confirmandoSoRetirada, setConfirmandoSoRetirada] = useState<'ativar' | 'desativar' | null>(null);
  const [horarioAbertura, setHorarioAbertura] = useState<string>('');
  const [horarioAberturaSaving, setHorarioAberturaSaving] = useState(false);

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
    getLojaOnlineSoRetirada().then(setSoRetirada);
    getLojaOnlineHorarioAbertura().then((h) => setHorarioAbertura(h ?? ''));
  }, []);

  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

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
      if (!novaAberta) {
        await setLojaOnlineSoRetiradaApi(false);
        setSoRetirada(false);
      }
      setConfirmandoToggle(null);
    } finally {
      setToggleLoading(false);
    }
  };

  const handleSoRetiradaClick = () => {
    if (soRetirada === null || soRetiradaLoading || !lanchoneteAberta) return;
    setConfirmandoSoRetirada(soRetirada ? 'desativar' : 'ativar');
  };

  const confirmarSoRetirada = async () => {
    if (confirmandoSoRetirada === null) return;
    const novo = confirmandoSoRetirada === 'ativar';
    setSoRetiradaLoading(true);
    try {
      await setLojaOnlineSoRetiradaApi(novo);
      setSoRetirada(novo);
      setConfirmandoSoRetirada(null);
    } finally {
      setSoRetiradaLoading(false);
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
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      {novoPedidoOnline && (
        <div className="fixed top-4 right-4 z-[100] flex flex-wrap items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 sm:px-4 sm:py-3 shadow-lg text-white animate-pulse text-sm sm:text-base">
          <span className="font-semibold">Novo pedido online!</span>
          <NavLink to="/admin/pedidos-online" className="underline font-medium" onClick={() => setMenuAberto(false)}>Ver ({pendentesOnline})</NavLink>
          <button onClick={fecharNovoPedido} className="rounded px-2 py-0.5 bg-amber-600 hover:bg-amber-700">Fechar</button>
        </div>
      )}
      {/* Overlay no mobile quando menu aberto */}
      <button
        type="button"
        aria-label="Fechar menu"
        className={`lg:hidden fixed inset-0 z-30 bg-black/50 transition-opacity ${menuAberto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMenuAberto(false)}
      />
      <aside
        className={`no-print flex flex-col border-r border-stone-200 bg-white z-40 transition-transform duration-200 ease-out fixed inset-y-0 left-0 w-64 lg:static lg:w-56 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3 sm:p-4 border-b border-stone-200 flex items-center justify-between">
          <NavLink to="/admin" className="flex items-center gap-2 font-bold text-stone-800" onClick={() => setMenuAberto(false)}>
            <img src="/logo-terra-mar.png" alt="Terra & Mar" className="h-8 w-8 rounded-full object-contain flex-shrink-0" />
            <span className="truncate">Admin</span>
          </NavLink>
          <button type="button" onClick={() => setMenuAberto(false)} className="lg:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, countKey }) => {
            const n = countKey ? counts[countKey] : 0;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuAberto(false)}
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
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <span className={`text-xs font-medium ${lanchoneteAberta ? 'text-stone-600' : 'text-stone-400'}`}>Só retirada</span>
            <button
              type="button"
              onClick={handleSoRetiradaClick}
              disabled={soRetirada === null || soRetiradaLoading || !lanchoneteAberta}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50 ${
                soRetirada ? 'bg-amber-500' : 'bg-stone-300'
              }`}
              role="switch"
              aria-checked={soRetirada ?? false}
              title={!lanchoneteAberta ? 'Ative a loja online para usar' : soRetirada ? 'Desativar só retirada' : 'Pedidos online apenas para retirada'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  soRetirada ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="px-3 py-2">
            <label className="block text-xs font-medium text-stone-600 mb-1">Abre às (loja online)</label>
            <input
              type="time"
              value={horarioAbertura}
              onChange={(e) => setHorarioAbertura(e.target.value)}
              onBlur={async () => {
                if (horarioAberturaSaving) return;
                setHorarioAberturaSaving(true);
                try {
                  await setLojaOnlineHorarioAberturaApi(horarioAbertura);
                } finally {
                  setHorarioAberturaSaving(false);
                }
              }}
              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
            {horarioAberturaSaving && <span className="text-xs text-stone-400">Salvando...</span>}
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
      {confirmandoSoRetirada !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Só retirada</h3>
            <p className="text-sm text-stone-600 mb-4">
              {confirmandoSoRetirada === 'ativar'
                ? 'Ativar "Só retirada"? Os pedidos online ficarão disponíveis apenas para retirada no local.'
                : 'Desativar "Só retirada"? Os pedidos online voltarão a aceitar entrega.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmarSoRetirada}
                disabled={soRetiradaLoading}
                className={`flex-1 rounded-lg py-2 font-medium text-white disabled:opacity-50 ${
                  confirmandoSoRetirada === 'ativar' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-stone-600 hover:bg-stone-700'
                }`}
              >
                {soRetiradaLoading ? 'Salvando...' : 'Sim, confirmar'}
              </button>
              <button onClick={() => setConfirmandoSoRetirada(null)} disabled={soRetiradaLoading} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Barra superior no mobile: hamburger + título */}
        <div className="lg:hidden flex-shrink-0 flex items-center gap-2 px-3 py-3 bg-white border-b border-stone-200 sticky top-0 z-20">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="p-2 rounded-lg text-stone-600 hover:bg-stone-100"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <NavLink to="/admin" className="flex items-center gap-2 font-bold text-stone-800 truncate min-w-0">
            <img src="/logo-terra-mar.png" alt="" className="h-7 w-7 rounded-full object-contain flex-shrink-0" />
            <span className="truncate">Admin</span>
          </NavLink>
        </div>
        <div className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
