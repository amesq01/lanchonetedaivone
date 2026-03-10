import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cozinhaSomTurnOff, cozinhaSomTurnOn } from '../lib/cozinhaSound';

type CozinhaSoundContextValue = {
  somAtivado: boolean;
  toggleSom: () => void;
};

const CozinhaSoundContext = createContext<CozinhaSoundContextValue | null>(null);

export function CozinhaSoundProvider({ children }: { children: ReactNode }) {
  const [somAtivado, setSomAtivado] = useState(true);

  const toggleSom = useCallback(() => {
    if (somAtivado) {
      cozinhaSomTurnOff();
      setSomAtivado(false);
    } else {
      cozinhaSomTurnOn();
      setSomAtivado(true);
    }
  }, [somAtivado]);

  return (
    <CozinhaSoundContext.Provider value={{ somAtivado, toggleSom }}>
      {children}
    </CozinhaSoundContext.Provider>
  );
}

export function useCozinhaSound() {
  const ctx = useContext(CozinhaSoundContext);
  return ctx;
}

export function CozinhaSoundToggle() {
  const ctx = useCozinhaSound();
  if (!ctx) return null;
  const { somAtivado, toggleSom } = ctx;
  return (
    <button
      type="button"
      onClick={toggleSom}
      className={`flex items-center justify-center p-1 ${
        somAtivado ? 'text-stone-500 hover:text-stone-800' : 'text-red-500 hover:text-red-600'
      }`}
      aria-label={somAtivado ? 'Desativar som de novos pedidos' : 'Ativar som de novos pedidos'}
    >
      {somAtivado ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
    </button>
  );
}
