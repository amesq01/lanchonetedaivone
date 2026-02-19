import CozinhaKanban from '../cozinha/CozinhaKanban';

export default function AdminCozinha() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Cozinha</h1>
      <div className="h-[calc(100vh-12rem)] min-h-[400px]">
        <CozinhaKanban />
      </div>
    </div>
  );
}
