import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { ESTOQUE_BAIXO_LIMITE, getProdutosEstoqueBaixo } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';

export default function AdminEstoqueBaixoBanner() {
  const { data: produtos = [] } = useQuery({
    queryKey: queryKeys.produtosEstoqueBaixo,
    queryFn: () => getProdutosEstoqueBaixo(),
    staleTime: 0,
  });

  if (produtos.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-900">
            Estoque baixo: {produtos.length} produto{produtos.length !== 1 ? 's' : ''} ativo
            {produtos.length !== 1 ? 's' : ''} com estoque abaixo de {ESTOQUE_BAIXO_LIMITE} unidades
          </p>
          <ul className="mt-2 max-h-40 overflow-y-auto text-sm text-amber-950">
            {produtos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2 border-t border-amber-200/80 py-1.5 first:border-0 first:pt-0">
                <span className="font-medium tabular-nums">
                  {p.quantidade === 0 ? (
                    <span className="text-red-700">Esgotado (0)</span>
                  ) : (
                    <span>{p.quantidade} un.</span>
                  )}
                </span>
                <span className="text-amber-900">
                  {p.codigo} — {p.nome}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/admin/produtos"
            className="mt-2 inline-block text-sm font-medium text-amber-800 underline hover:text-amber-950"
          >
            Ajustar em Produtos
          </Link>
        </div>
      </div>
    </div>
  );
}
