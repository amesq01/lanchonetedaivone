import { QueryClient } from '@tanstack/react-query';

/** Query keys usados no app para cache e invalidação. */
export const queryKeys = {
  pedidosOnline: ['pedidos-online'] as const,
  pedidosViagem: ['pedidos-viagem'] as const,
  pedidosCozinha: ['pedidos-cozinha'] as const,
  adminSidebarCounts: ['admin-sidebar-counts'] as const,
  produtos: (ativoOnly?: boolean) => (ativoOnly === undefined ? ['produtos'] as const : ['produtos', { ativoOnly }] as const),
  categorias: ['categorias'] as const,
  mesasDashboard: ['mesas-dashboard'] as const,
  /** Atendente: detalhe da mesa (comanda + pedidos). Invalida em Realtime ao mudar comandas/pedidos. */
  mesaDetail: (mesaId: string) => ['mesa-detail', mesaId] as const,
  /** Admin: detalhe da mesa (comanda + pedidos + conta + pagamentos). Invalida em Realtime. */
  adminMesaDetail: (mesaId: string) => ['admin-mesa-detail', mesaId] as const,
  /** Config da loja online (aberta, soRetirada, agenda, formas, taxa). Invalida quando admin altera. */
  lojaConfig: ['loja-config'] as const,
  cuponsAtivos: ['cupons-ativos'] as const,
  atendentes: ['atendentes'] as const,
  cupons: ['cupons'] as const,
  configTaxaEntrega: ['config', 'taxa_entrega'] as const,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s
      refetchOnWindowFocus: false,
    },
  },
});
