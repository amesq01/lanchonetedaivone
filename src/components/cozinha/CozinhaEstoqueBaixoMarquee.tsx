import { useQuery } from '@tanstack/react-query';
import { ESTOQUE_BAIXO_LIMITE, getProdutosEstoqueBaixo } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';

function rotuloProduto(p: { codigo: string; nome: string; quantidade: number }): string {
  if (p.quantidade === 0) return `${p.codigo} — ${p.nome} (esgotado)`;
  return `${p.codigo} — ${p.nome} (${p.quantidade} un.)`;
}

export default function CozinhaEstoqueBaixoMarquee() {
  const { data: produtos = [] } = useQuery({
    queryKey: queryKeys.produtosEstoqueBaixo,
    queryFn: () => getProdutosEstoqueBaixo(),
    staleTime: 0,
  });

  if (produtos.length === 0) return null;

  const itens = produtos.map(rotuloProduto).join('   •   ');
  const texto = `Estoque baixo (abaixo de ${ESTOQUE_BAIXO_LIMITE} un.): ${itens}`;
  const duracao = Math.max(18, produtos.length * 7);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-1 min-w-0 overflow-hidden"
      title={texto}
    >
      <div
        className="estoque-marquee-track text-sm font-semibold text-red-600"
        style={{ animationDuration: `${duracao}s` }}
      >
        <span className="px-4 whitespace-nowrap">{texto}</span>
        <span className="px-4 whitespace-nowrap" aria-hidden>
          {texto}
        </span>
      </div>
    </div>
  );
}
