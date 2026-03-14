import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryKeys } from './queryClient';

const DEBOUNCE_MS = 200;

function invalidatePedidoQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.pedidosOnline });
  queryClient.invalidateQueries({ queryKey: queryKeys.pedidosViagem });
  queryClient.invalidateQueries({ queryKey: queryKeys.pedidosCozinha });
  queryClient.invalidateQueries({ queryKey: queryKeys.adminSidebarCounts });
  queryClient.invalidateQueries({ queryKey: queryKeys.mesasDashboard });
  queryClient.invalidateQueries({ queryKey: ['mesa-detail'] });
  queryClient.invalidateQueries({ queryKey: ['admin-mesa-detail'] });
}

function debouncedInvalidatePedidos(queryClient: QueryClient) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      invalidatePedidoQueries(queryClient);
    }, DEBOUNCE_MS);
  };
}

function debouncedInvalidateComandas(queryClient: QueryClient) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSidebarCounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.pedidosViagem });
      queryClient.invalidateQueries({ queryKey: queryKeys.mesasDashboard });
      queryClient.invalidateQueries({ queryKey: ['mesa-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-mesa-detail'] });
    }, DEBOUNCE_MS);
  };
}

/**
 * Inscreve nas mudanças de pedidos, pedido_itens e comandas via Supabase Realtime.
 * Invalidação em debounce: vários eventos em sequência (ex.: edição de itens com muitos INSERT/DELETE)
 * disparam apenas uma invalidação e um refetch, evitando dezenas de chamadas.
 */
export function subscribePedidosAndComandasRealtime(queryClient: QueryClient): () => void {
  const schedulePedidos = debouncedInvalidatePedidos(queryClient);
  const scheduleComandas = debouncedInvalidateComandas(queryClient);

  const channel = supabase
    .channel('pedidos-comandas-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedidos' },
      schedulePedidos
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedido_itens' },
      schedulePedidos
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comandas' },
      scheduleComandas
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
