import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLanchoneteAberta, getLojaOnlineSoRetirada, getLojaOnlineFormasPagamento, getLojaOnlineAgendaAbertura, getConfig, mensagemAberturaFromAgenda } from '../lib/api';
import { queryKeys } from '../lib/queryClient';

type LojaConfig = {
  loading: boolean;
  lanchoneteAberta: boolean | null;
  soRetirada: boolean;
  mensagemAbertura: string | null;
  formasPagamento: string[];
  taxaEntrega: number | null;
  agendaAbertura: { dias: number[]; horario: string } | null;
  reload: () => Promise<void>;
};

const LojaConfigContext = createContext<LojaConfig | undefined>(undefined);

const FORMAS_PADRAO = ['PIX', 'Crédito', 'Débito', 'Dinheiro'];

export function LojaConfigProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: queryKeys.lojaConfig,
    queryFn: async () => {
      const [aberta, soRet, formas, agenda, taxa] = await Promise.all([
        getLanchoneteAberta(),
        getLojaOnlineSoRetirada(),
        getLojaOnlineFormasPagamento(),
        getLojaOnlineAgendaAbertura(),
        getConfig('taxa_entrega'),
      ]);
      const mensagemAbertura = mensagemAberturaFromAgenda(agenda);
      return {
        lanchoneteAberta: aberta,
        soRetirada: soRet,
        mensagemAbertura,
        formasPagamento: formas,
        taxaEntrega: taxa,
        agendaAbertura: agenda,
      };
    },
  });

  const data = query.data;
  const value: LojaConfig = {
    loading: query.isLoading,
    lanchoneteAberta: data?.lanchoneteAberta ?? null,
    soRetirada: data?.soRetirada ?? false,
    mensagemAbertura: data?.mensagemAbertura ?? null,
    formasPagamento: data?.formasPagamento ?? FORMAS_PADRAO,
    taxaEntrega: data?.taxaEntrega ?? null,
    agendaAbertura: data?.agendaAbertura ?? null,
    reload: () => query.refetch().then(() => {}),
  };

  return (
    <LojaConfigContext.Provider value={value}>
      {children}
    </LojaConfigContext.Provider>
  );
}

export function useLojaConfig() {
  const ctx = useContext(LojaConfigContext);
  if (!ctx) throw new Error('useLojaConfig deve ser usado dentro de LojaConfigProvider');
  return ctx;
}
