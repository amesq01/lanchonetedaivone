import CozinhaKanban from '../cozinha/CozinhaKanban';
import { CozinhaSoundProvider, CozinhaSoundToggle } from '../../contexts/CozinhaSoundContext';
import CozinhaEstoqueBaixoMarquee from '../../components/cozinha/CozinhaEstoqueBaixoMarquee';

export default function AdminCozinha() {
  return (
    <CozinhaSoundProvider>
      <div>
            <div className="mb-4 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-800">Cozinha</h1>
            <CozinhaSoundToggle />
          </div>
          <CozinhaEstoqueBaixoMarquee />
        </div>
        <div className="h-[calc(100vh-12rem)] min-h-[400px]">
          <CozinhaKanban />
        </div>
      </div>
    </CozinhaSoundProvider>
  );
}
