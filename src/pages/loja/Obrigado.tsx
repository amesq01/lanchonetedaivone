import { Link } from 'react-router-dom';

export default function LojaObrigado() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">Pedido recebido!</h1>
        <p className="text-stone-600 mb-6">Em breve entraremos em contato pelo WhatsApp para confirmar.</p>
        <Link to="/" className="inline-block rounded-lg bg-amber-600 px-6 py-2 text-white hover:bg-amber-700">
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
