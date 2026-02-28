import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPedidosViagemAbertos } from '../../lib/api';

export default function AtendenteViagem() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await getPedidosViagemAbertos();
    setPedidos(data.filter((p) => p.status === 'novo_pedido'));
    setLoading(false);
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Mesa VIAGEM</h1>
      <p className="text-stone-600 mb-4">Pedidos para viagem. Nunca bloqueada.</p>
      <Link to="/pdv/viagem/novo" className="mb-6 block w-full rounded-xl bg-amber-600 py-3 text-center font-medium text-white hover:bg-amber-700">
        NOVO PEDIDO
      </Link>
      <div className="space-y-3">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm border border-stone-200">
            <div className="font-semibold text-stone-800">Pedido #{p.numero}</div>
            <div className="text-sm text-stone-600">{p.cliente_nome}</div>
            <ul className="text-sm text-stone-500 mt-1">
              {(p.pedido_itens ?? []).map((i: any) => (
                <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
