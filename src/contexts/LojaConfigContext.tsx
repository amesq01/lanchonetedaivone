import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getLanchoneteAberta, getLojaOnlineSoRetirada, getLojaOnlineMensagemAbertura, getLojaOnlineFormasPagamento, getLojaOnlineAgendaAbertura, getConfig } from '../lib/api';

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

export function LojaConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<LojaConfig, 'reload'>>({
    loading: true,
    lanchoneteAberta: null,
    soRetirada: false,
    mensagemAbertura: null,
    formasPagamento: ['PIX', 'Cartão crédito', 'Cartão débito', 'Dinheiro'],
    taxaEntrega: null,
    agendaAbertura: null,
  });

  const reload = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const [aberta, soRet, mensagem, formas, agenda, taxa] = await Promise.all([
        getLanchoneteAberta(),
        getLojaOnlineSoRetirada(),
        getLojaOnlineMensagemAbertura(),
        getLojaOnlineFormasPagamento(),
        getLojaOnlineAgendaAbertura(),
        getConfig('taxa_entrega'),
      ]);
      setState({
        loading: false,
        lanchoneteAberta: aberta,
        soRetirada: soRet,
        mensagemAbertura: mensagem,
        formasPagamento: formas,
        taxaEntrega: taxa,
        agendaAbertura: agenda,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LojaConfigContext.Provider value={{ ...state, reload }}>
      {children}
    </LojaConfigContext.Provider>
  );
}

export function useLojaConfig() {
  const ctx = useContext(LojaConfigContext);
  if (!ctx) throw new Error('useLojaConfig deve ser usado dentro de LojaConfigProvider');
  return ctx;
}

